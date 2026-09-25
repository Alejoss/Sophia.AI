# Knowledge-path snapshot readiness

Author/staff endpoint for **snapshot publish readiness** (JWT / session auth).

This is **not** the Vincent machine-to-machine ingest route
(`/api/content/knowledge-path-ingest/...`, which requires
`X-Transcript-Ingest-Key`).

**Implementation**: `knowledge_paths.views.KnowledgePathSnapshotReadinessView`  
**Builder**: `knowledge_paths.services.snapshot_preview.knowledge_path_snapshot_readiness`

---

## `GET /api/knowledge_paths/{id}/snapshot-readiness/`

Requires an authenticated **author** of the path or **staff**.

### Example

```bash
curl -s "https://academiablockchain.com/api/knowledge_paths/10/snapshot-readiness/" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Response (shape)

| Field | Meaning |
|-------|---------|
| `readyForStrictPublish` | `true` when every node has non-empty certified transcript text |
| `validForHash` | Live document validates for hashing (preview mode may still have empty texts) |
| `liveDigest` | SHA-256 of current live preview document (when `validForHash`) |
| `issues` | Gap list (`NO_TRANSCRIPT_TEXT`, …) with `nodeTitle` + `nodeId` |
| `nodes[]` | Per-node title, content id, `hasCertifiedText`, `textSha256` |
| `published.latest` | Latest admin-persisted snapshot (`version`, `digest`, …) or `null` |
| `blockchain` | Stub until KP digest OP_RETURN is wired (`status: not_implemented`) |

Omits the full snapshot `document` / `canonical` bytes. For those, use
`GET /api/knowledge_paths/{id}/snapshot-preview/`.
