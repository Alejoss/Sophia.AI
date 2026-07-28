# Embedding ingest (worker ack) + Qdrant

Sophia does **not** store embedding vectors in Postgres. An external worker
(Vincent) upserts chunks to **Qdrant Cloud**. Sophia:

1. Exposes a machine-to-machine **embedding-ingest** API (queue + ack).
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
| `GET` | `/embedding-ingest/{content_id}/` | One item + transcript embedding summary |
| `PUT` | `/embedding-ingest/{content_id}/` | Worker ack (`indexed` / `failed` / `skipped`) |

### Queue query params

- `topic_id`, `media_type`, `content_id`
- `status` — comma-separated override (e.g. `pending,stale`)
- `include_completed` — also list `indexed` / `skipped`
- `limit` / `offset`

Default queue statuses: `pending`, `stale`, `failed`.

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
