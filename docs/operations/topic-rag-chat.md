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
- The Consultas tab is only shown when `Topic.chat_enabled` is true **and**
  the topic has at least one VIDEO/AUDIO with `embedding_status=indexed`.
  Enabling the flag via topic edit / PATCH fails with **400** if nothing is
  indexed yet. Chat API still returns **403** when the flag is off.
- If Qdrant drops the TLS connection (`Connection reset by peer`), the client
  retries a few times, then the API returns **502** with a Spanish error instead
  of an unhandled **500**.

---

## Debugging “not found” answers (e.g. Adam Back)

A consultation can say the entity is missing for **different** reasons. Distinguish
them before changing retrieval or the prompt.

### 1. Look at `sources` on the saved consultation

In the UI, open the consultation and check **Fuentes**:

| What you see | Meaning |
|--------------|---------|
| No Fuentes / empty `sources` | Dense search returned nothing usable (or payloads lack `text`). Fixed Spanish “No encontré fragmentos…” may appear — **no LLM call**. |
| Fuentes present, but excerpts never mention the entity | Retrieval ranked the wrong chunks. The model correctly refuses (grounding). Common for **proper nouns** with dense-only search. |
| Fuentes mention the entity, answer still refuses | Prompt / truncation / over-refusal — inspect context length and system prompt. |

API: `GET /api/content/topics/{topic_id}/chat/queries/{query_id}/` (own queries only).

### 2. Confirm the text exists in Postgres for that topic

```bash
cd acbc_app && . .venv/bin/activate
# native runs: export ENVIRONMENT=DEVELOPMENT DB_* … as in AGENTS.md
python manage.py shell -c "
from content.models import ContentTranscript
from content.transcript_utils import resolve_hash_source_text
kw='Adam Back'
for t in ContentTranscript.objects.filter(content__topics__id=TOPIC_ID).select_related('content'):
    body = resolve_hash_source_text(t) or ''
    if kw.casefold() in body.casefold():
        print(t.content_id, t.embedding_status, t.chunk_count, t.content.original_title)
"
```

If matches are `pending` / `stale` / `failed` / `skipped`, fix indexing first
(embed worker + `PUT /api/content/embedding-ingest/{content_id}/`).

### 3. Confirm Qdrant has points for the topic

```bash
python manage.py check_qdrant --topic-id TOPIC_ID
```

`0` points with `chat_enabled` and Postgres `indexed` rows → embed-worker / ack gap
(or wrong `topic_id` on Qdrant payloads).

### 4. One-shot classifier: `debug_topic_chat`

```bash
# Saved consultation (no OpenAI/Qdrant required)
python manage.py debug_topic_chat --query-id QUERY_ID --keyword "Adam Back"

# Live embed + Qdrant search (needs OPENAI_* + QDRANT_*)
python manage.py debug_topic_chat \
  --topic-id TOPIC_ID \
  --message "¿Quién es Adam Back?" \
  --keyword "Adam Back"
```

Classification modes:

| Mode | Likely cause |
|------|----------------|
| `retrieval_miss` | Indexed Postgres text has the keyword; top Qdrant chunks do not → dense ranking miss (typical for names). |
| `index_gap` | Keyword only on non-`indexed` transcripts → re-embed / ack. |
| `empty_retrieval` | No Qdrant context and no Postgres hits → wrong topic / spelling / empty corpus. |
| `grounding_refuse` | Keyword in sources (or refusal without keyword probe) → inspect LLM grounding. |
| `ok` | Sources mention the keyword; focus on answer quality / UI. |

Add `--json` for machine-readable output. Logic lives in
`acbc_app/content/topic_chat_debug.py`.

### 5. Likely root cause for entity questions

Sophia’s consult path is **dense-only** (`text-embedding-3-large` → Qdrant
filter by `topic_id` → top-k with max 2 chunks per content). Short questions
about people (“Adam Back”) often fail to rank name-mention chunks even when the
name appears across the topic. Hybrid keyword fallback is a follow-up fix once
`debug_topic_chat` confirms `retrieval_miss`.

## Related

- Architecture: [topic-rag-embeddings.md](../architecture/topic-rag-embeddings.md)
- [qdrant-embeddings.md](qdrant-embeddings.md)
- [environment-variables.md](../deployment/environment-variables.md)
