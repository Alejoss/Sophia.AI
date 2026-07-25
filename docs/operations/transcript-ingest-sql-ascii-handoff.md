# Handoff: 500 en transcript-ingest por encoding PostgreSQL (`SQL_ASCII` vs UTF8)

**Repo:** [Alejoss/Sophia.AI](https://github.com/Alejoss/Sophia.AI)  
**Fecha:** 2026-07-24  
**Origen:** worker externo Vincent-Code + Sentry PRODUCTION  
**Prioridad:** alta (bloquea ingesta de transcripts en español)

---

## Síntoma

Worker externo llama:

```http
PUT /api/content/transcript-ingest/{content_id}/
```

- Auth OK (`X-Transcript-Ingest-Key` / Bearer).
- `GET /api/content/transcript-ingest/?topic_id=…` funciona.
- Muchos `PUT` devuelven **HTTP 500** con HTML genérico de Django (sin JSON de error).

---

## Sentry (producción)

| Campo | Valor |
|-------|--------|
| Exception | `NotSupportedError` (psycopg / PostgreSQL) |
| Message | `conversion between UTF8 and SQL_ASCII is not supported` |
| Detail en el mensaje | caret sobre línea de subtítulos, p.ej. `00:00:04.340 --> 00:00:07.020` |
| Transaction | `/api/content/transcript-ingest/{content_id}/` |
| Ejemplo | `…/api/content/transcript-ingest/400/` |
| Environment | `PRODUCTION` |
| Runtime | CPython 3.12.x |
| Handled | no |

---

## Causa raíz

La base PostgreSQL de producción tiene **`SERVER_ENCODING = SQL_ASCII`**.

El cliente Django/psycopg envía texto **UTF-8** (transcripts en español con acentos, SRT/VTT, markdown Obsidian). PostgreSQL no puede convertir UTF8 → SQL_ASCII → excepción no manejada → **500** + Sentry.

No es un bug de auth ni del contrato del worker. Es **encoding de la DB**.

---

## Evidencia operativa (worker, `topic_id=2`)

Cola inicial: 14 VIDEO/AUDIO, todos sin transcript.

| Resultado | Content IDs | Notas |
|-----------|-------------|--------|
| PUT **201** OK | `48`, `350`, `354` | Payloads más cortos / menos Unicode problemático |
| PUT **500** | `45`, `46`, `47`, `49`, `50`, `51`, `53`, `355`, `400` | Español con acentos, SRT, notas Obsidian largas |
| Fallo local (no API) | `55`, `63` | `yt-dlp` ausente en el laptop del worker — irrelevante para este ticket |

Tras la corrida: remoto `completed=3`, `pending=11`.

---

## Código involucrado

| Pieza | Path |
|--------|------|
| Endpoint PUT | `acbc_app/content/views_transcript_ingest.py` → `ContentTranscriptIngestDetailView.put` |
| Model | `acbc_app/content/models.py` → `ContentTranscript` |
| Campos Text | `parsed_plain`, `processed_plain`, `obsidian_markdown`, `source_subtitles` |
| Campos JSON | `segments`, `obsidian_frontmatter` |
| Save hook | `ContentTranscript.save` → `sync_transcript_derived_fields()` en `acbc_app/content/transcript_utils.py` |
| Contrato API | `docs/api/transcript-ingest.md` |
| Helpers encoding | `acbc_app/utils/db_encoding.py` (`prepare_text_for_db`, `is_sql_ascii_database`) |
| Check | `python manage.py check_db_encoding` |
| Migración | `scripts/migrate-db-to-utf8.sh` |
| Compose (solo DB **nuevas**) | `docker-compose.prod.yml` → `POSTGRES_INITDB_ARGS=--encoding=UTF8 --locale=C.UTF-8` |
| Precedente | `docs/backend/notifications.md` (verbs degradados por SQL_ASCII) |

### Por qué revienta aquí

`prepare_text_for_db()` existe para degradar Unicode en SQL_ASCII, pero el path de **`ContentTranscript` ingest no lo usa**. Al persistir TextField/JSON con acentos o subtítulos UTF-8, PostgreSQL lanza `NotSupportedError` (no se convierte en `ValidationError`) → 500.

El volumen Docker legacy puede seguir en `SQL_ASCII` aunque `POSTGRES_INITDB_ARGS` pida UTF8 (eso solo aplica al `initdb` inicial).

---

## Fix esperado

### Preferido: migrar DB a UTF8

En el droplet:

```bash
cd /ruta/al/repo   # donde está docker-compose.prod.yml

docker compose --env-file .env.compose -f docker-compose.prod.yml exec backend \
  python manage.py check_db_encoding

# Si reporta SQL_ASCII (backup primero):
./scripts/migrate-db-to-utf8.sh
```

Verificar:

```sql
SHOW SERVER_ENCODING;  -- debe ser UTF8
```

Reprobar:

```http
PUT /api/content/transcript-ingest/46/
Content-Type: application/json
X-Transcript-Ingest-Key: <key>

{
  "processed_plain": "Texto con acentos: qué, también, español",
  "parsed_plain": "Texto con acentos: qué, también, español",
  "language": "es"
}
```

Esperado: **200/201**, no 500.

### Mitigación temporal (solo si la migración se demora)

- Aplicar `prepare_text_for_db` / `prepare_json_for_db` a los campos de `ContentTranscript` antes de `save()`, **o**
- Capturar `NotSupportedError` y devolver 503/409 con mensaje claro.

**No** es deseable a largo plazo: destroza acentos en transcripts en español.

---

## Acceptance criteria

1. `check_db_encoding` en prod → UTF8 (exit 0).
2. `PUT` de transcript español con acentos (+ opcional `source_subtitles` SRT/VTT) → **201/200**.
3. Sentry deja de emitir `NotSupportedError` en esa transaction.
4. Worker Vincent puede completar topic 2 (salvo fallos de origen: Spotify sin yt-dlp, etc.).

---

## Contexto del caller (referencia; no es el fix)

| Item | Valor |
|------|--------|
| Worker | Vincent-Code `scripts/process_topic_transcripts.py` |
| API base | `https://www.academiablockchain.com/api` |
| Auth | `X-Transcript-Ingest-Key` |
| Doc worker | Vincent-Code `docs/workflows/topic-transcripts-sophia.md` |
| Reuse local | Match por YouTube `video_id` en SQLite `video_transcript` → nota Obsidian |

---

## Fuera de alcance de este ticket

- Auth del ingest / Cloudflare (GET y auth ya OK).
- Contrato del API worker.
- Pipelines Whisper/captions del laptop.
- Fallos `yt-dlp` en el worker.

---

## Pregunta operativa

¿La DB del volumen Docker en el droplet sigue en `SQL_ASCII` pese a `POSTGRES_INITDB_ARGS=UTF8`? Si sí → backup + `migrate-db-to-utf8.sh` + confirmar encoding + reintentar PUTs del topic 2.
