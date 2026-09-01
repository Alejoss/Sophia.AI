# Embedding ingest (worker ack) + Qdrant

Sophia does **not** store embedding vectors in Postgres. An external worker
(Vincent) upserts chunks to **Qdrant Cloud**. Sophia:

1. Exposes a machine-to-machine **embedding-ingest** API (topic queue, content queue, ack).
2. Updates `ContentTranscript.embedding_*` bookkeeping on ack.
3. Reads Qdrant later for topic similarity / RAG (`utils.qdrant_client`).

Auth is the same secret as transcript ingest: `TRANSCRIPT_INGEST_API_KEY`
(`X-Transcript-Ingest-Key` or `Authorization: Bearer`).

---

## Endpoints

Base: `/api/content/embedding-ingest/`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/embedding-ingest/` | Queue of VIDEO/AUDIO with transcript needing embed work |
| `GET` | `/embedding-ingest/topics/` | Topics that have at least one transcript matching the status filter |
| `GET` | `/embedding-ingest/{content_id}/` | One item + transcript embedding summary |
| `PUT` | `/embedding-ingest/{content_id}/` | Worker ack (`indexed` / `failed` / `skipped`) |

### Queue query params

Shared by the content queue and the topic queue:

- `media_type`
- `status` — comma-separated override (e.g. `pending,stale`)
- `include_completed` — also match `indexed` / `skipped`
- `limit` / `offset`

Content queue only (optional filter on the topic queue too):

- `topic_id`, `content_id`

Default queue statuses: `pending`, `stale`, `failed`.

Content not linked to any topic still appears in `GET /embedding-ingest/`
but **not** in the topic queue (Vincent has no `topic_id` for those points).

### Topic queue (`GET /embedding-ingest/topics/`)

Discover which topics need embed work. Each item:

```json
{
  "id": 12,
  "title": "Bitcoin",
  "is_public": true,
  "chat_enabled": false,
  "matching_count": 3,
  "status_counts": {
    "pending": 2,
    "stale": 1,
    "failed": 0,
    "indexed": 5,
    "skipped": 0
  }
}
```

- `matching_count` — VIDEO/AUDIO transcripts whose `embedding_status` is in the
  request's status filter (default: pending/stale/failed).
- `status_counts` — full breakdown for that topic (not limited to the filter).
- Topics with `matching_count = 0` are omitted. Ordered by `matching_count`
  descending, then `id`.
- The same content linked to several topics is counted on **each** topic
  (Qdrant points are filtered by `topic_id`).

Recommended worker flow:

1. `GET /api/content/embedding-ingest/topics/`
2. For each topic, `GET /api/content/embedding-ingest/?topic_id=<id>`
3. Embed chunks, upsert to Qdrant with that `topic_id`, then `PUT` ack.

Content-queue items include `topics: [{ "id", "title" }, ...]` so a payload can
carry every topic the content belongs to.

### Ack body (`status=indexed`)

```json
{
  "status": "indexed",
  "embedding_model": "text-embedding-3-large",
  "embedding_dims": 3072,
  "chunk_count": 7,
  "embedded_text_hash": "<optional; defaults to current text_hash>"
}
```

If `embedded_text_hash` is sent and differs from the transcript’s current
`text_hash` → **409 Conflict** (re-embed the current text).

### Ack body (`status=failed`)

```json
{
  "status": "failed",
  "embedding_error": "Qdrant upsert failed: …"
}
```

---

## Qdrant env (Sophia)

In `acbc_app/.env` (and production droplet `.env`):

```env
QDRANT_URL=https://9032e54e-3c3a-4080-831e-0ab14ce16951.us-west-2-0.aws.cloud.qdrant.io
QDRANT_API_KEY=…
QDRANT_COLLECTION=sophia_acbc_topic_chunks
QDRANT_VECTOR_SIZE=3072
```

- **Cluster ID** is not required — only URL + API key.
- The Qdrant **cluster** display name (`SophiaACBC`) is independent of the **collection** name.
- Create the API key in the Qdrant dashboard → cluster → **API Keys**.

Verify (local Docker if `.env` has the key; **also** on the droplet after copying the same vars to production `.env`):

```bash
docker compose exec backend python manage.py check_qdrant
docker compose exec backend python manage.py check_qdrant --ensure-collection
```

`--ensure-collection` creates `sophia_acbc_topic_chunks` with Cosine / 3072 dims if missing.

---

## Payload convention (for workers writing to Qdrant)

Each point payload should include at least:

- `topic_id` (int)
- `content_id` (int | null)
- `media_type`
- `chunk_index`
- `text_hash`
- `doc_key`
- `embedding_model`
- `text` (chunk text for citations; optional if hydrated from Django later)

Filter RAG searches with `topic_id`.

---

## Related

- Topic RAG chat UI/API: [topic-rag-chat.md](topic-rag-chat.md)
- Transcript ingest: [transcript-ingest.md](../api/transcript-ingest.md)
- Env reference: [environment-variables.md](../deployment/environment-variables.md#qdrant-cloud-topic-embeddings)
