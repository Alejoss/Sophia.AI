# Embedding ingest (worker ack) + Qdrant

Sophia does **not** store embedding vectors in Postgres. An external worker
(Vincent) upserts chunks to **Qdrant Cloud**. Sophia:

1. Exposes a machine-to-machine **embedding-ingest** API (queue + ack).
2. Updates `ContentTranscript.embedding_*` bookkeeping on ack.
3. Reads Qdrant later for topic similarity / RAG (`utils.qdrant_client`).

Auth is the same secret as transcript ingest: `TRANSCRIPT_INGEST_API_KEY`
(`X-Transcript-Ingest-Key` or `Authorization: Bearer`).

Architecture overview: [topic-rag-embeddings.md](../architecture/topic-rag-embeddings.md).

---

## Endpoints

Base: `/api/content/embedding-ingest/`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/embedding-ingest/` | Queue of VIDEO/AUDIO with transcript needing embed work |
| `GET` | `/embedding-ingest/{content_id}/` | One item + transcript embedding summary |
| `PUT` | `/embedding-ingest/{content_id}/` | Worker ack (`indexed` / `failed` / `skipped`) |

### Queue query params

- `topic_id`, `media_type`, `content_id`
- `status` — comma-separated override (e.g. `pending,stale`)
- `include_completed` — also list `indexed` / `skipped`
- `limit` / `offset` (default limit 50, max 200)

Default queue statuses: `pending`, `stale`, `failed`.

### List queue — example

```bash
curl -s "http://localhost:8000/api/content/embedding-ingest/?topic_id=12&limit=10" \
  -H "X-Transcript-Ingest-Key: $TRANSCRIPT_INGEST_API_KEY"
```

Response `200`:

```json
{
  "count": 1,
  "limit": 10,
  "offset": 0,
  "include_completed": false,
  "status_filter": ["failed", "pending", "stale"],
  "topic_id": 12,
  "items": [
    {
      "id": 46,
      "media_type": "VIDEO",
      "original_title": "Introducción a Bitcoin",
      "original_author": "Autor",
      "url": "https://www.youtube.com/watch?v=…",
      "is_youtube": true,
      "youtube_video_id": "abc123",
      "has_file": true,
      "file_key": "content/video/…",
      "file_size": 1048576,
      "has_spanish_subtitles": false,
      "has_spanish_dubbing": false,
      "has_transcript": true,
      "created_at": "2026-01-15T10:00:00Z",
      "text_hash": "a1b2c3…",
      "text_length": 4200,
      "language": "es",
      "embedding_status": "pending",
      "embedding_model": "",
      "embedding_dims": null,
      "chunk_count": null,
      "embedded_text_hash": null,
      "embedded_at": null
    }
  ]
}
```

Queue items include manifest fields (same base as transcript-ingest) **plus**
embedding metadata. They do **not** include full transcript text bodies.

### Get detail — example

```bash
curl -s "http://localhost:8000/api/content/embedding-ingest/46/" \
  -H "X-Transcript-Ingest-Key: $TRANSCRIPT_INGEST_API_KEY"
```

Response `200`:

```json
{
  "content": { "...queue item fields as above..." },
  "has_transcript": true,
  "transcript": {
    "format": "SRT",
    "language": "es",
    "text_length": 4200,
    "text_hash": "a1b2c3…",
    "segment_count": 42,
    "has_parsed_plain": true,
    "has_processed_plain": true,
    "has_obsidian_markdown": true,
    "obsidian_frontmatter": { "title": "…", "language_code": "es" },
    "embedding_status": "pending",
    "embedding_model": "",
    "embedding_dims": null,
    "chunk_count": null,
    "embedded_text_hash": null,
    "embedded_at": null,
    "created_at": "…",
    "updated_at": "…"
  }
}
```

**409** if the content has no transcript yet (transcribe first via
[transcript-ingest](../api/transcript-ingest.md)).

---

## Ack bodies

### `status=indexed`

Required fields: `embedding_model`, `embedding_dims`, `chunk_count`.

```json
{
  "status": "indexed",
  "embedding_model": "text-embedding-3-large",
  "embedding_dims": 3072,
  "chunk_count": 7,
  "embedded_text_hash": "<optional; defaults to current text_hash>",
  "embedded_at": "2026-07-28T18:00:00Z"
}
```

If `embedded_text_hash` is sent and differs from the transcript’s current
`text_hash` → **409 Conflict** (re-embed the current text).

Response `200`:

```json
{
  "content_id": 46,
  "transcript": {
    "format": "SRT",
    "language": "es",
    "text_length": 4200,
    "text_hash": "a1b2c3…",
    "embedding_status": "indexed",
    "embedding_model": "text-embedding-3-large",
    "embedding_dims": 3072,
    "chunk_count": 7,
    "embedded_text_hash": "a1b2c3…",
    "embedded_at": "2026-07-28T18:00:00Z",
    "...": "..."
  }
}
```

### `status=failed`

Required field: `embedding_error`.

```json
{
  "status": "failed",
  "embedding_error": "Qdrant upsert failed: connection timeout"
}
```

Optional: `embedding_model`, `embedding_dims` (preserved for debugging).

### `status=skipped`

Use when embedding is intentionally not applicable (e.g. empty transcript,
unsupported language, manual opt-out).

```json
{
  "status": "skipped",
  "embedding_error": "Transcript too short to chunk"
}
```

Optional: `embedding_model`. Skipped status is **sticky** — transcript saves
will not auto-reset it to `pending`.

---

## Recommended embed worker flow

The embed worker (Vincent) runs **after** transcript ingest. It is not part of
this repository.

1. **Configure** `BASE_URL`, `TRANSCRIPT_INGEST_API_KEY`, OpenAI credentials,
   and Qdrant Cloud URL + API key (same collection name as Sophia:
   `QDRANT_COLLECTION`, default `sophia_acbc_topic_chunks`).

2. **Ensure collection** exists (Cosine, 3072 dims) — either run Sophia’s
   `python manage.py check_qdrant --ensure-collection` or create the collection
   from the worker with the same settings.

3. **Poll the queue**:

   ```bash
   curl -s "$BASE_URL/api/content/embedding-ingest/?status=pending,stale,failed" \
     -H "X-Transcript-Ingest-Key: $TRANSCRIPT_INGEST_API_KEY"
   ```

   Optionally filter by `topic_id` or `content_id`.

4. **For each item**, obtain transcript text to chunk:
   - **Preferred**: keep `processed_plain` (or equivalent) in the worker’s local
     cache from the transcript step (same `content_id` + `text_hash`).
   - The embedding-ingest and transcript-ingest GET endpoints return **metadata
     only** — not full text bodies. If the worker did not cache text, it must
     re-derive it from its transcript pipeline or read from a trusted internal
     source; do not guess from hashes alone.

5. **Resolve `topic_id`(s)** for the content (worker-side: content–topic M2M
   from Django ORM, admin export, or a future API). Each Qdrant point must
   carry every `topic_id` the content belongs to, or run one index pass per
   topic if your worker duplicates points.

6. **Chunk** `processed_plain` (primary source; fall back to parsed plain /
   Obsidian body using the same rules as `resolve_hash_source_text()` in
   `transcript_utils.py`). Chunk size/overlap is worker-defined; keep chunks
   small enough that citation excerpts fit topic chat context (~400 chars shown
   in UI).

7. **Embed** chunks with OpenAI `text-embedding-3-large` (3072 dimensions).
   Must match `OPENAI_EMBEDDING_MODEL` / `QDRANT_VECTOR_SIZE` in Sophia.

8. **Upsert to Qdrant**:
   - On **`stale`** or re-index: delete existing points for this `content_id`
     (filter delete) **or** use deterministic point IDs and overwrite in place.
   - Include payload fields listed below.
   - Use stable point IDs when possible, e.g. `{content_id}_{chunk_index}` or a
     UUID derived from `doc_key`, so retries are idempotent.

9. **Ack success or failure** via `PUT /api/content/embedding-ingest/{content_id}/`.

10. **Verify** (optional):

    ```bash
    python manage.py check_qdrant --topic-id 12
    ```

### Errors (embedding-ingest)

| Status | When |
|--------|------|
| **403** | Missing/wrong API key, or `TRANSCRIPT_INGEST_API_KEY` unset |
| **404** | Unknown `topic_id` on queue, or unknown `content_id` |
| **400** | Bad query params; non VIDEO/AUDIO content; invalid ack body |
| **409** | No transcript yet; `embedded_text_hash` mismatch on indexed ack |

---

## Qdrant env (Sophia)

In `acbc_app/.env` (and production droplet `.env`):

```env
QDRANT_URL=https://your-cluster.us-west-2-0.aws.cloud.qdrant.io
QDRANT_API_KEY=…
QDRANT_COLLECTION=sophia_acbc_topic_chunks
QDRANT_VECTOR_SIZE=3072
```

- **Cluster ID** is not required — only URL + API key.
- The Qdrant **cluster** display name is independent of the **collection** name.
- Create the API key in the Qdrant dashboard → cluster → **API Keys**.

Verify (local Docker if `.env` has the key; **also** on the droplet after
copying the same vars to production `.env`):

```bash
docker compose exec backend python manage.py check_qdrant
docker compose exec backend python manage.py check_qdrant --ensure-collection
docker compose exec backend python manage.py check_qdrant --topic-id 2
```

`--ensure-collection` creates `sophia_acbc_topic_chunks` with Cosine / 3072
dims if missing.

---

## Payload convention (for workers writing to Qdrant)

Each point payload should include at least:

| Field | Type | Notes |
|-------|------|-------|
| `topic_id` | int | Required for RAG filter |
| `content_id` | int | Source video/audio |
| `media_type` | string | `VIDEO` or `AUDIO` |
| `chunk_index` | int | 0-based index within content |
| `text_hash` | string | Transcript `text_hash` at index time |
| `doc_key` | string | Stable id, e.g. `{content_id}:{chunk_index}` |
| `embedding_model` | string | e.g. `text-embedding-3-large` |
| `text` | string | Chunk plain text for citations in topic chat |

Sophia’s RAG search filters with `topic_id` and reads `text`, `content_id`,
and `chunk_index` from payloads. If `text` is omitted, the UI may show empty
excerpts even when retrieval scores are high.

Filter RAG searches with `topic_id` (see `QdrantClient.search()` in
`utils/qdrant_client.py`).

---

## Related

- Architecture: [topic-rag-embeddings.md](../architecture/topic-rag-embeddings.md)
- Topic RAG chat UI/API: [topic-rag-chat.md](topic-rag-chat.md)
- Transcript ingest (prerequisite): [transcript-ingest.md](../api/transcript-ingest.md)
- Env reference: [environment-variables.md](../deployment/environment-variables.md#qdrant-cloud-topic-embeddings)
- Tests: `ContentEmbeddingIngestAPITests` in `acbc_app/content/tests.py`
