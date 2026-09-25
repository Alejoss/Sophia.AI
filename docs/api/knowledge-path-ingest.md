# Knowledge-path ingest detail (Vincent)

Machine-to-machine **read** endpoint so Vincent can inspect one knowledge path:
ordered nodes, linked content, transcript presence, and embedding bookkeeping.

**Content is atomic:** VIDEO, AUDIO, and TEXT (PDF) all use the same
`ContentTranscript` fields. Snapshot hashing embeds that plain text — not PDF
bytes. IMAGE has no transcript pipeline.

User JWT auth is **not** used. Auth matches transcript and embedding ingest.

**Implementation**: `acbc_app/content/views_knowledge_path_ingest.py`  
**Env var**: [`TRANSCRIPT_INGEST_API_KEY`](../deployment/environment-variables.md#transcript_ingest_api_key)

Related:

- [Transcript ingest](transcript-ingest.md) — queue + `PUT` (VIDEO/AUDIO/**TEXT**)
- [Qdrant embeddings + embed worker](../operations/qdrant-embeddings.md) — embed after transcript
- [Knowledge-path snapshot readiness](knowledge-path-snapshot-readiness.md) — author/staff JWT (not Vincent)

---

## Authentication

```http
X-Transcript-Ingest-Key: <TRANSCRIPT_INGEST_API_KEY>
```

or `Authorization: Bearer <TRANSCRIPT_INGEST_API_KEY>`.

---

## `GET /api/content/knowledge-path-ingest/{knowledge_path_id}/`

Unknown id → **404**.

### Example

```bash
curl -s "https://academiablockchain.com/api/content/knowledge-path-ingest/10/" \
  -H "X-Transcript-Ingest-Key: $TRANSCRIPT_INGEST_API_KEY"
```

### How Vincent should count work

**Needs transcript extraction** (VIDEO, AUDIO, **and TEXT/PDF**):

```text
content != null
AND content.media_type in {VIDEO, AUDIO, TEXT}
AND content.has_transcript == false
```

Then `PUT /api/content/transcript-ingest/{content_id}/`  
(`format=PLAIN` for PDF/text extracts).

**Missing embedding** (inventory):

```text
content != null AND content.embedding_status !== "indexed"
```

Embed only after a transcript exists (including TEXT). Use
`PUT /api/content/embedding-ingest/{content_id}/` and bind to `text_hash`.

### `summary` aggregates

| Field | Meaning |
|-------|---------|
| `node_count` | Nodes on the path |
| `nodes_with_content` | Nodes with a linked content profile |
| `nodes_with_transcript` | Nodes whose content has a `ContentTranscript` row |
| `nodes_with_certified_text` | Nodes with non-empty certified plain text (snapshot materials) |
| `nodes_embedding_indexed` | Nodes with `embedding_status == "indexed"` |
| `ready_for_strict_publish` | Every node has content **and** certified text |

There is **no** derived “embedding needing work” summary field — count from
`nodes[].content.embedding_status` as above.

### Other node fields

| Field | Meaning |
|-------|---------|
| `nodes[].title` / `node_id` | Lesson title and stable id |
| `has_certified_text` | Non-empty normalized plain text (what KP snapshots embed) |
| `content.file_key` / YouTube fields | How to obtain media for extraction |

Full transcript bodies are not returned here. Detail text for embed:
`GET /api/content/embedding-ingest/{content_id}/` → `transcript.index_text`.

### Suggested loop

1. `GET` this path endpoint  
2. Extract every VIDEO/AUDIO/**TEXT** with `has_transcript == false` → transcript-ingest PUT  
3. Embed contents with `embedding_status !== "indexed"` (transcript required) → embedding-ingest PUT  
4. Re-GET until `summary.ready_for_strict_publish` (and desired embeddings are `indexed`)
