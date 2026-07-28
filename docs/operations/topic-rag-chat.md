# Topic RAG chat

Authenticated users can ask questions about a topic. Sophia:

1. Embeds the question with OpenAI (`text-embedding-3-large`).
2. Searches Qdrant filtered by `topic_id`.
3. Asks an OpenAI chat model to answer **only** from those transcript chunks.
4. Returns the answer plus citation sources.

Vectors are **not** stored in Django. They must already be indexed by the
external embed worker (see [qdrant-embeddings.md](qdrant-embeddings.md)).

---

## Endpoint

```http
POST /api/content/topics/{topic_id}/chat/
Authorization: Bearer <JWT>
Content-Type: application/json
```

### Request

```json
{
  "message": "¿Qué dicen sobre el tamaño de los bloques?",
  "history": [
    { "role": "user", "content": "…" },
    { "role": "assistant", "content": "…" }
  ]
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `message` | yes | 1–4000 chars |
| `history` | no | Max 12 turns; used only for conversational context (retrieval uses `message`) |

### Response `200`

```json
{
  "topic_id": 2,
  "answer": "Según las transcripciones… [1]",
  "sources": [
    {
      "index": 1,
      "content_id": 46,
      "title": "Título del video",
      "chunk_index": 3,
      "score": 0.81,
      "excerpt": "…",
      "transcript_url": "/content/46/transcript?context=topic"
    }
  ]
}
```

### Errors

| Status | When |
|--------|------|
| 401 | Not authenticated |
| 400 | Empty / invalid body |
| 404 | Topic missing or not visible to the user |
| 503 | `OPENAI_API_KEY` or Qdrant env missing |
| 502 | OpenAI / Qdrant upstream failure |

---

## Environment

```env
OPENAI_API_KEY=sk-…
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_CHAT_MODEL=gpt-4o-mini
TOPIC_CHAT_TOP_K=8
TOPIC_CHAT_MAX_CONTEXT_CHARS=12000
```

Also requires `QDRANT_URL`, `QDRANT_API_KEY`, and an indexed collection.

---

## Behaviour notes

- Retrieval is scoped to one `topic_id`.
- At most two chunks per `content_id` in the prompt (dedupe).
- If no chunks have usable `text` payload, the API returns a fixed “no encontré…” answer without calling the chat model.
- Prompt instructs the model not to invent facts outside the context.

## Related

- [qdrant-embeddings.md](qdrant-embeddings.md)
- [environment-variables.md](../deployment/environment-variables.md)
