# Knowledge-path ingest detail (Vincent)

Machine-to-machine **read** endpoint so an external worker (Vincent) can inspect a
knowledge path’s ordered nodes and each linked content’s transcript / embedding
bookkeeping — the same fields used by embedding-ingest queues.

User JWT auth is **not** used. Auth matches transcript and embedding ingest.

**Implementation**: `acbc_app/content/views_knowledge_path_ingest.py`  
**Env var**: [`TRANSCRIPT_INGEST_API_KEY`](../deployment/environment-variables.md#transcript_ingest_api_key)

Related:

- [Transcript ingest](transcript-ingest.md)
- [Qdrant embeddings + embed worker](../operations/qdrant-embeddings.md)
- [Knowledge-path snapshot schema](../hackathon/knowledge-path-snapshot-schema.md)

---

## Authentication

Set `TRANSCRIPT_INGEST_API_KEY` on the backend. If it is empty, the endpoint
returns **403**.

Send one of:

```http
X-Transcript-Ingest-Key: <TRANSCRIPT_INGEST_API_KEY>
```

```http
Authorization: Bearer <TRANSCRIPT_INGEST_API_KEY>
```

---

## `GET /api/content/knowledge-path-ingest/{knowledge_path_id}/`

Returns one knowledge path with ordered nodes. Unknown id → **404**.

### Example

```bash
curl -s "http://localhost:8000/api/content/knowledge-path-ingest/42/" \
  -H "X-Transcript-Ingest-Key: $TRANSCRIPT_INGEST_API_KEY"
```

### Response `200`

```json
{
  "id": 42,
  "knowledge_path_id": "sophia-acbc:knowledge-path:42",
  "title": "Introduction to Bitcoin",
  "description": "…",
  "author_id": 7,
  "author_username": "demo-teacher",
  "is_visible": true,
  "created_at": "2026-09-01T12:00:00Z",
  "updated_at": "2026-09-20T15:00:00Z",
  "nodes": [
    {
      "id": 101,
      "node_id": "sophia-acbc:node:101",
      "title": "What is Bitcoin?",
      "description": "…",
      "order": 1,
      "position": 1,
      "media_type": "VIDEO",
      "content_profile_id": 55,
      "has_certified_text": true,
      "content": {
        "id": 55,
        "media_type": "VIDEO",
        "original_title": "Intro a Bitcoin",
        "original_author": "Satoshi",
        "url": "https://www.youtube.com/watch?v=…",
        "is_youtube": true,
        "youtube_video_id": "…",
        "has_file": true,
        "file_key": "content/video/…",
        "file_size": 1048576,
        "has_spanish_subtitles": false,
        "has_spanish_dubbing": false,
        "has_transcript": true,
        "created_at": "2026-01-15T10:00:00Z",
        "topics": [],
        "text_hash": "a1b2c3…",
        "text_length": 4200,
        "language": "en",
        "embedding_status": "indexed",
        "embedding_model": "text-embedding-3-large",
        "embedding_dims": 3072,
        "chunk_count": 2,
        "embedded_text_hash": "a1b2c3…",
        "embedded_at": "2026-01-16T10:00:00Z",
        "topic_ids": []
      }
    }
  ],
  "summary": {
    "node_count": 1,
    "nodes_with_content": 1,
    "nodes_with_transcript": 1,
    "nodes_with_certified_text": 1,
    "nodes_embedding_indexed": 1,
    "nodes_embedding_needing_work": 0,
    "ready_for_strict_publish": true
  }
}
```

### Fields

| Field | Meaning |
|-------|---------|
| `knowledge_path_id` / `node_id` | Stable hackathon identifiers (`sophia-acbc:…`) |
| `position` | 1-based order rank (same as snapshot `position`) |
| `content` | Same manifest shape as [embedding-ingest queue items](../operations/qdrant-embeddings.md) (`ContentEmbeddingQueueItemSerializer`), or `null` if the node has no linked content |
| `has_certified_text` | `true` when normalized transcript plain text is non-empty (what snapshot materials embed) |
| `summary.ready_for_strict_publish` | Every node has content **and** certified transcript text |

This endpoint does **not** return full transcript bodies. Use
`GET /api/content/embedding-ingest/{content_id}/` for `index_text`, or the
public/certified transcript routes when appropriate.

Workers that need to **write** transcripts or embedding acks continue to use the
existing transcript-ingest and embedding-ingest PUT endpoints.
