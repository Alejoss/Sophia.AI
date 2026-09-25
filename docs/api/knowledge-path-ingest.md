# Knowledge-path ingest detail (Vincent)

Machine-to-machine **read** endpoint so Vincent can inspect one knowledge path:
ordered nodes, linked content, transcript presence, and embedding bookkeeping.

Use this to decide **which contents need transcript extraction** and to see each
content’s current `embedding_status`. It does **not** invent a derived “needs
embedding work” queue count — count from per-node fields yourself.

User JWT auth is **not** used. Auth matches transcript and embedding ingest.

**Implementation**: `acbc_app/content/views_knowledge_path_ingest.py`  
**Env var**: [`TRANSCRIPT_INGEST_API_KEY`](../deployment/environment-variables.md#transcript_ingest_api_key)

Related:

- [Transcript ingest](transcript-ingest.md) — queue + `PUT` to write transcripts
- [Qdrant embeddings + embed worker](../operations/qdrant-embeddings.md) — embed queue + ack
- [Knowledge-path snapshot readiness](knowledge-path-snapshot-readiness.md) — author/staff JWT readiness (not for Vincent)

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

Do **not** use a user JWT. Opening the URL in a browser without the ingest key
returns 403.

---

## `GET /api/content/knowledge-path-ingest/{knowledge_path_id}/`

Returns one knowledge path with ordered nodes. Unknown id → **404**.

### Example

```bash
curl -s "https://academiablockchain.com/api/content/knowledge-path-ingest/10/" \
  -H "X-Transcript-Ingest-Key: $TRANSCRIPT_INGEST_API_KEY"
```

### Response `200` (shape)

```json
{
  "id": 10,
  "knowledge_path_id": "sophia-acbc:knowledge-path:10",
  "title": "…",
  "description": "…",
  "author_id": 1,
  "author_username": "admin",
  "is_visible": true,
  "created_at": "…",
  "updated_at": "…",
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
      "has_certified_text": false,
      "content": {
        "id": 55,
        "media_type": "VIDEO",
        "original_title": "…",
        "url": "…",
        "is_youtube": true,
        "youtube_video_id": "…",
        "has_file": true,
        "file_key": "content/video/…",
        "file_size": 1048576,
        "has_transcript": false,
        "text_hash": null,
        "text_length": null,
        "language": "",
        "embedding_status": null,
        "topic_ids": [],
        "topics": []
      }
    }
  ],
  "summary": {
    "node_count": 1,
    "nodes_with_content": 1,
    "nodes_with_transcript": 0,
    "nodes_with_certified_text": 0,
    "nodes_embedding_indexed": 0,
    "ready_for_strict_publish": false
  }
}
```

`content` is `null` when the node has no linked content profile.

This endpoint does **not** return full transcript bodies. For embed `index_text`
use `GET /api/content/embedding-ingest/{content_id}/`. To **write** a transcript
use `PUT /api/content/transcript-ingest/{content_id}/`. To **ack** embeddings use
`PUT /api/content/embedding-ingest/{content_id}/`.

---

## How Vincent should read the response

### Path / node identity

| Field | Meaning |
|-------|---------|
| `id` / `knowledge_path_id` | DB id and stable `sophia-acbc:knowledge-path:{id}` |
| `nodes[].id` / `node_id` | DB node id and stable `sophia-acbc:node:{id}` |
| `nodes[].title` | Human lesson title |
| `nodes[].position` | 1-based order (same as snapshot) |
| `nodes[].media_type` | Node media type (`VIDEO`, `AUDIO`, `TEXT`, `IMAGE`) |
| `nodes[].content.id` | Content id to pass to transcript-ingest / embedding-ingest |

### Transcript state (extraction)

| Field | Meaning |
|-------|---------|
| `content.has_transcript` | `true` if a `ContentTranscript` row exists |
| `nodes[].has_certified_text` | `true` if normalized plain text is non-empty (what KP snapshots embed) |
| `content.text_hash` / `text_length` / `language` | Present when a transcript exists |
| `content.file_key` / `url` / `is_youtube` / `youtube_video_id` | How to obtain media for Whisper / captions |

**Contents that still need transcript extraction** (typical rule):

```text
content != null
AND content.media_type in {VIDEO, AUDIO}
AND content.has_transcript == false
```

(Optional stricter: also require `has_certified_text == false` after a partial ingest.)

TEXT/PDF nodes usually do **not** go through transcript-ingest; the embed worker
reads the file. IMAGE has no transcript pipeline.

### Embedding state

| Field | Meaning |
|-------|---------|
| `content.embedding_status` | `null` = no `ContentEmbedding` row yet; else `pending` \| `stale` \| `failed` \| `indexed` \| `skipped` |
| `content.embedded_text_hash` / `chunk_count` / `embedding_model` / … | Bookkeeping after ack |

**Contents without an indexed embedding** (inventory):

```text
content != null AND content.embedding_status !== "indexed"
```

That includes `null`, `pending`, `stale`, `failed`, and `skipped`. Count from
**nodes**, not from a summary “needs work” field (there isn’t one).

**Note:** VIDEO/AUDIO cannot be usefully embedded until they have a transcript.
TEXT can be embedded from the file alone. Decide embed eligibility in the worker
from `media_type` + `has_transcript`; Sophia does not pre-filter that here.

### `summary` (aggregates only)

| Field | Meaning |
|-------|---------|
| `node_count` | Number of nodes on the path |
| `nodes_with_content` | Nodes with a linked content profile |
| `nodes_with_transcript` | Nodes whose content has a transcript row |
| `nodes_with_certified_text` | Nodes with non-empty certified plain text |
| `nodes_embedding_indexed` | Nodes whose `embedding_status == "indexed"` |
| `ready_for_strict_publish` | `true` only if every node has content **and** certified text (snapshot materials complete). Independent of embedding index status. |

There is **no** `nodes_embedding_needing_work` field. Derive embed/transcript work
lists from the per-node rules above.

---

## Suggested Vincent loop for one knowledge path

1. `GET /api/content/knowledge-path-ingest/{path_id}/` with ingest key  
2. For each VIDEO/AUDIO with `has_transcript == false` → extract →  
   `PUT /api/content/transcript-ingest/{content_id}/`  
3. For each content that should be embedded (`embedding_status !== "indexed"`,
   and transcript present for A/V) → embed →  
   `PUT /api/content/embedding-ingest/{content_id}/`  
4. Re-GET the path until `summary.ready_for_strict_publish` is true (for
   certified snapshot materials) and/or every desired content is `indexed`
