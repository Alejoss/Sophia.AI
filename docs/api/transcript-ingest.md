# Transcript ingest API (external workers)

Machine-to-machine API for an **external** transcript worker (typically run on a laptop with local Whisper and optional YouTube captions). The worker is **not** part of this monorepo.

Workers:

1. Pull a work queue / topic manifest of VIDEO/AUDIO content
2. Obtain media via **S3 object key** (`file_key`) and/or **YouTube URL**
3. Produce text artifacts (and optional SRT/VTT)
4. Upsert them with `PUT`

User-facing JWT auth is **not** used. Media download URLs are **not** pre-signed; give the worker read-only AWS credentials to your bucket.

**Implementation**: `acbc_app/content/views_transcript_ingest.py`  
**Env var**: [`TRANSCRIPT_INGEST_API_KEY`](../deployment/environment-variables.md#transcript_ingest_api_key)

---

## Authentication

Set `TRANSCRIPT_INGEST_API_KEY` on the backend. If it is empty, every ingest endpoint returns **403**.

Send one of:

```http
X-Transcript-Ingest-Key: <TRANSCRIPT_INGEST_API_KEY>
```

```http
Authorization: Bearer <TRANSCRIPT_INGEST_API_KEY>
```

Do not use a user JWT for these routes.

---

## Endpoints

Base path: `/api/content/transcript-ingest/`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/content/transcript-ingest/` | Queue / topic manifest |
| `GET` | `/api/content/transcript-ingest/{content_id}/` | One item + transcript status |
| `PUT` | `/api/content/transcript-ingest/{content_id}/` | Create or replace transcript (idempotent) |

Only `media_type` **VIDEO** and **AUDIO** are accepted. TEXT/IMAGE return **400** on detail/PUT.

---

## `GET /api/content/transcript-ingest/`

Lists VIDEO/AUDIO contents for the worker.

### Query parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `topic_id` | int | — | Only contents linked to this topic. Unknown id → **404**. |
| `include_completed` | bool | `false` | If `true`/`1`/`yes`/`on`, also return items that already have a transcript (for local reconciliation). Default queue = pending only. |
| `media_type` | string | — | `VIDEO` or `AUDIO` |
| `content_id` | int | — | Single content filter |
| `limit` | int | `100` | Page size (max `500`) |
| `offset` | int | `0` | Pagination offset |

### Response

```json
{
  "count": 2,
  "limit": 100,
  "offset": 0,
  "include_completed": false,
  "topic_id": 12,
  "items": [
    {
      "id": 101,
      "media_type": "VIDEO",
      "original_title": "Intro a Bitcoin",
      "original_author": "Satoshi",
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "is_youtube": true,
      "youtube_video_id": "dQw4w9WgXcQ",
      "has_file": true,
      "file_key": "content/video/3/abc123_intro.mp4",
      "file_size": 52428800,
      "has_spanish_subtitles": true,
      "has_spanish_dubbing": false,
      "has_transcript": false,
      "created_at": "2026-07-01T12:00:00Z"
    }
  ]
}
```

### Manifest fields (per item)

| Field | Meaning for the worker |
|-------|-------------------------|
| `url` | Canonical external URL if any (often YouTube) |
| `is_youtube` / `youtube_video_id` | Prefer caption fetch before ASR when true |
| `has_file` / `file_key` | S3 object key under your media bucket; download with AWS SDK |
| `file_size` | Bytes when known (plan audio-only vs full video) |
| `has_spanish_subtitles` / `has_spanish_dubbing` | Accessibility flags from upload (not proof a `ContentTranscript` exists) |
| `has_transcript` | Whether Django already stores a transcript |

`file_key` is the storage key only (e.g. `content/video/...`). There is **no** pre-signed URL in this API.

---

## `GET /api/content/transcript-ingest/{content_id}/`

```json
{
  "content": { "...same manifest fields as queue items..." },
  "has_transcript": true,
  "transcript": {
    "format": "SRT",
    "language": "es",
    "text_length": 420,
    "text_hash": "sha256...",
    "segment_count": 12,
    "has_parsed_plain": true,
    "has_processed_plain": true,
    "has_obsidian_markdown": true,
    "obsidian_frontmatter": { "title": "Demo", "language_code": "es" },
    "created_at": "...",
    "updated_at": "..."
  }
}
```

`transcript` is `null` when none exists. Summary never returns full text bodies (only flags + metadata).

---

## `PUT /api/content/transcript-ingest/{content_id}/`

Idempotent upsert: creates (**201**, `created: true`) or replaces (**200**, `created: false`).

### Body

| Field | Required | Description |
|-------|----------|-------------|
| `parsed_plain` | one of three* | Plain text before NLP cleanup |
| `processed_plain` | one of three* | Cleaned plain text (primary for hash / future RAG) |
| `obsidian_markdown` | one of three* | Note with optional YAML frontmatter + body |
| `source_subtitles` | no | Raw SRT or VTT; server parses timed `segments` |
| `format` | no | `SRT` (default) or `VTT` |
| `language` | no | ISO 639-1, e.g. `es` |

\*At least one of `parsed_plain`, `processed_plain`, `obsidian_markdown` must be non-empty.

### Example

```bash
curl -X PUT "http://localhost:8000/api/content/transcript-ingest/101/" \
  -H "Content-Type: application/json" \
  -H "X-Transcript-Ingest-Key: $TRANSCRIPT_INGEST_API_KEY" \
  -d '{
    "parsed_plain": "Hola mundo.\nSegunda línea.",
    "processed_plain": "Hola mundo. Segunda línea.",
    "obsidian_markdown": "---\ntitle: Demo\nlanguage_code: es\n---\nHola mundo. Segunda línea.",
    "source_subtitles": "1\n00:00:01,000 --> 00:00:04,000\nHola mundo.\n",
    "format": "SRT",
    "language": "es"
  }'
```

### Response

```json
{
  "content_id": 101,
  "created": true,
  "transcript": {
    "format": "SRT",
    "language": "es",
    "text_length": 28,
    "text_hash": "...",
    "segment_count": 1,
    "has_parsed_plain": true,
    "has_processed_plain": true,
    "has_obsidian_markdown": true,
    "obsidian_frontmatter": { "title": "Demo", "language_code": "es" },
    "created_at": "...",
    "updated_at": "..."
  }
}
```

Invalid optional subtitles → **400**. Missing all three text artifacts → **400**.

### Embedding status (Postgres only)

Each transcript tracks whether its current `text_hash` still needs vector indexing later.
Vectors themselves are **not** stored in Django; these fields prepare an embed worker:

| Field | Meaning |
|-------|---------|
| `embedding_status` | `pending` \| `indexed` \| `stale` \| `failed` \| `skipped` |
| `embedded_text_hash` | Hash that was last indexed (compare to `text_hash`) |
| `embedding_model` / `embedding_dims` / `chunk_count` / `embedded_at` | Filled by a future embed-worker ack |

On every successful PUT/save:

- new transcript → `pending`
- text changes while previously indexed → `stale` (keeps prior `embedding_model` / `chunk_count` until re-acked)
- same `text_hash` as `embedded_text_hash` and already `indexed` → stays `indexed`

The ingest summary returns these fields. Embed-queue / chat endpoints are out of scope for this API.

---

## Recommended worker flow

1. Configure `BASE_URL`, `TRANSCRIPT_INGEST_API_KEY`, and AWS read-only access to the media bucket.
2. Fetch pending work for a topic:

   ```bash
   curl -s "http://localhost:8000/api/content/transcript-ingest/?topic_id=12" \
     -H "X-Transcript-Ingest-Key: $TRANSCRIPT_INGEST_API_KEY"
   ```

3. For each item (suggested order):
   - Skip if already done locally **and** `has_transcript` is true (optional check via detail GET).
   - If `is_youtube`: try captions first (`youtube-transcript-api` / TimedText / similar).
   - Else if `has_file` / `file_key`: `s3.get_object` (or download audio-only) → Whisper.
   - Else if YouTube URL without captions: `yt-dlp` audio → Whisper.
   - Else mark failed / needs manual.
4. `PUT` artifacts (include `source_subtitles` when you have SRT/VTT so the server stores timed segments).
5. Optionally reconcile:

   ```bash
   curl -s "http://localhost:8000/api/content/transcript-ingest/?topic_id=12&include_completed=true" \
     -H "X-Transcript-Ingest-Key: $TRANSCRIPT_INGEST_API_KEY"
   ```

Keep a local cache keyed by `content_id` (media + outputs) so re-runs do not re-download from S3.

---

## Errors

| Status | When |
|--------|------|
| **403** | Missing/wrong API key, or `TRANSCRIPT_INGEST_API_KEY` unset |
| **404** | Unknown `topic_id` on queue, or unknown `content_id` on detail/PUT |
| **400** | Bad query params; non VIDEO/AUDIO content; empty PUT body; invalid SRT/VTT |

---

## Related

- Env: [environment-variables.md](../deployment/environment-variables.md#transcript_ingest_api_key)
- Model: `ContentTranscript` in `acbc_app/content/models.py`
- Tests: `ContentTranscriptIngestAPITests` in `acbc_app/content/tests.py`
