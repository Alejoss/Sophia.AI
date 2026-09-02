# Topic RAG consultations

Authenticated users ask **independent** questions about a topic. Sophia:

1. Embeds the question with OpenAI (`text-embedding-3-large`).
2. Searches Qdrant filtered by `topic_id`.
3. Asks an OpenAI chat model to answer **only** from those transcript chunks.
4. Persists the consultation (`TopicChatQuery`: question, answer, sources).
5. Returns the saved consultation (including `id` for history).

This is **not** multi-turn conversational memory. Each `POST` is a separate
query; previous answers are not sent back to the LLM. (Embedding past chats
into Qdrant is a future option.)

Vectors for transcripts are **not** stored in Django. They must already be
indexed by the external embed worker (see [qdrant-embeddings.md](qdrant-embeddings.md)).

---

## Endpoints

All require JWT. Only the owning user can list/read their consultations.

### Create consultation

```http
POST /api/content/topics/{topic_id}/chat/
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{ "message": "¿Qué dicen sobre el tamaño de los bloques?" }
```

Response `201`:

```json
{
  "id": 12,
  "topic_id": 2,
  "question": "¿Qué dicen sobre el tamaño de los bloques?",
  "answer": "Según las transcripciones… [1]",
  "sources": [
    {
      "index": 1,
      "content_id": 46,
      "title": "Título del video",
      "chunk_index": 3,
      "score": 0.81,
      "excerpt": "…",
      "media_type": "VIDEO",
      "has_transcript": true,
      "source_url": "/content/46/transcript?context=topic&topicId=2",
      "transcript_url": "/content/46/transcript?context=topic"
    }
  ],
  "created_at": "2026-07-28T18:00:00Z"
}
```

### List own consultations

```http
GET /api/content/topics/{topic_id}/chat/queries/?limit=50
```

```json
{
  "count": 2,
  "limit": 50,
  "results": [
    {
      "id": 12,
      "topic_id": 2,
      "question_preview": "¿Qué dicen sobre el tamaño…",
      "created_at": "…"
    }
  ]
}
```

### Get one consultation

```http
GET /api/content/topics/{topic_id}/chat/queries/{query_id}/
```

Same shape as the create response. Other users get **404**.

### Errors (create)

| Status | When |
|--------|------|
| 401 | Not authenticated |
| 400 | Empty / invalid body |
| 404 | Topic missing or not visible |
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
- If no chunks have usable `text` payload, the API still persists a fixed
  “no encontré…” answer (no chat-model call).
- Per-user / per-topic daily rate limits are **not** implemented yet.
- The Conversación tab is only shown when `Topic.chat_enabled` is true **and**
  the topic has at least one VIDEO/AUDIO with `embedding_status=indexed`.
  Enabling the flag via topic edit / PATCH fails with **400** if nothing is
  indexed yet. Chat API still returns **403** when the flag is off.
- If Qdrant drops the TLS connection (`Connection reset by peer`), the client
  retries a few times, then the API returns **502** with a Spanish error instead
  of an unhandled **500**.
- Citation `source_url` points to the transcript page only when a
  `ContentTranscript` exists (typical VIDEO/AUDIO). TEXT/PDF and other files
  without a transcript link to `/content/{id}/topic/{topic_id}` so the UI
  opens the file in the topic view instead of an empty transcript page.

## Related

- Architecture: [topic-rag-embeddings.md](../architecture/topic-rag-embeddings.md)
- [qdrant-embeddings.md](qdrant-embeddings.md)
- [environment-variables.md](../deployment/environment-variables.md)
