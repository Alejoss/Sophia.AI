# Club de Lectura (Book Clubs)

Este documento describe el **Club de Lectura** como capa de producto sobre Knowledge Paths, Topics, Events y Comments: hub con temporalidad, misiones, debates, comunidad, investigación y administración desde el dashboard.

## Objetivo

Acompañar un ciclo de lectura en cohorte sin duplicar los primitivos de la plataforma:

| Necesidad del club | Reutiliza |
|--------------------|-----------|
| Misiones / capítulos | `KnowledgePath` + `Node` + `UserNodeCompletion` |
| Investigación (timeline + biblioteca) | `Topic` + `TopicTimeline` + `Content` |
| Reuniones en vivo | `Event` + `BookClubEvent` |
| Debates abiertos | `DiscussionQuestion` + `Comment` (GFK) |
| Presentación del lector | `Profile.profile_description` / `external_url` (+ marca en membresía) |
| Telegram / ciclo | campos en `BookClub` |

App Django: `acbc_app/book_clubs/`.  
Frontend hub: `frontend/src/bookClubs/`.  
Admin dashboard: `frontend/src/bookClubs/admin/` bajo `/dashboard/book-clubs/…`.

---

## Modelo de dominio

### `BookClub`

Contenedor del ciclo (`book_clubs/models.py`).

Campos relevantes:

- `title`, `slug`, `description`, `cover_image`
- `status`: `draft` \| `active` \| `closed`
- `starts_at`, `ends_at` — temporalidad del ciclo (hub / fase)
- `telegram_group_url` — grupo del ciclo (Comunidad + Inicio)
- `knowledge_path` (FK, opcional; si falta al crear, se genera un path vacío)
- `topic` (FK, opcional) — **tema de Investigación** (timeline + conteos de media)
- `created_by`, timestamps

### `BookClubMembership`

- `role`: `member` \| `mentor` \| `admin`
- `intro_updated_at` — el miembro completó **Preséntate** en este club
- Espejos legacy: `intro_description`, `social_url`, `additional_url`  
  **Fuente de verdad de la bio:** `Profile.profile_description` y `Profile.external_url`.  
  `additional_url` es opcional y solo del club.

**Se presentó** ⇔ `intro_updated_at IS NOT NULL`.

### `BookClubEvent`

Une un `Event` existente al club (sin alterar el modelo `Event`).

### `DiscussionQuestion`

Pregunta de debate abierta (no es un `Quiz`).

- Ligada a `book_club`, opcionalmente a `node` (misión) y/o `event` (directo)
- `status`: `draft` \| `open` \| `closed`
- `opens_at` / `closes_at` — auto transición draft→open→closed
- Respuestas: `Comment` con GFK → `DiscussionQuestion`  
  Endpoint tipado: `/api/comments/discussion-question/<id>/`

---

## Hub público (lectores)

Rutas bajo `/club-de-lectura/:slug/…` (`BookClubLayout` + outlet):

| Tab | Ruta | Contenido |
|-----|------|-----------|
| Inicio | `/` | Estado del ciclo, progreso, próxima misión, próximo directo, CTAs |
| Misiones | `/misiones` | Nodos del knowledge path |
| Debates | `/preguntas`, `/preguntas/:id` | `DiscussionQuestion` + hilos públicos |
| Comunidad | `/comunidad` | Miembros presentados, Telegram, eco reciente |
| **Investigación** | `/investigacion` | Tema vinculado: conteos VIDEO/IMAGE/AUDIO/TEXT + timeline embebido |
| Reuniones | `/reuniones` | Eventos del club |
| Preséntate | `/presentate` | Formulario que escribe en Profile |

Landing waitlist / gate: `/club-de-lectura`.

### Investigación (detalle)

Componente: `BookClubInvestigation.jsx`.

1. Lee `hub.quick_links.topic_id` (o `club.topic`).
2. Carga título/descripción (`GET /api/content/topics/<id>/basic/`).
3. Conteos por tipo (`GET …/content/<VIDEO|IMAGE|AUDIO|TEXT>/` con `page_size=1` → campo `count`).
4. Embebe `<TopicTimeline topicId={…} canEdit={false} canSuggest={false} />`.
5. **Ver detalles ↗** abre `/content/topics/:id?tab=timeline` en **nueva pestaña**.

No incluye en el hub: galería completa, comentarios del topic ni edición de timeline.

Invitados sin cuenta: la API de topics/timeline exige auth → CTA de login/crear cuenta.

Relación con Topics/timeline: ver [topics-and-knowledge-paths.md](topics-and-knowledge-paths.md).

### Comunidad vs Investigación

- **Comunidad**: personas + Telegram + actividad social.
- **Investigación**: narrativa y material del **tema** (timeline + conteos).

Solo miembros con presentación aparecen en el roster público de Comunidad. Mentores/admins pueden listar todos con `?include_all=1`.

---

## Acceso e onboarding

- **Guest email gate**: `POST /api/book_clubs/<slug>/guest-access/` → token firmado + email; header `X-Book-Club-Guest`.
- **Join**: `POST /api/book_clubs/<slug>/join/`.
- **Preséntate**: `GET/PATCH /api/book_clubs/<slug>/membership/introduction/`  
  Lee/escribe Profile; marca `intro_updated_at`.

---

## Dashboard admin (staff / gestores)

Base: `/dashboard/book-clubs/:slug/…`

| Sección | Qué editar |
|---------|------------|
| **General** | Título, descripción, Telegram, estado, fechas del ciclo, portada |
| **Conexiones** | Knowledge path (misiones) + **tema de Investigación**; vista previa de conteos y # entradas de timeline; atajos a editar path/timeline/contenido |
| **Reuniones** | Vincular / desvincular `Event`s |
| **Preguntas** | CRUD de `DiscussionQuestion` (estado, misión, directo, schedule) |
| **Miembros** | Roster completo + roles (PR de presentaciones / roster; puede llegar en un merge aparte) |

Crear club: `/dashboard/book-clubs/nuevo` (staff).

Comando útil:

```bash
python manage.py create_book_club \
  --title "Club Cypherpunk" \
  --path-id <ID> \
  --topic-id <ID> \
  --username admin
```

### Cómo preparar Investigación

1. Dashboard → club → **Conexiones** → elegir **Tema de investigación** → Guardar.
2. En el tema: editar timeline (`/content/topics/:id/edit?tab=timeline`) y contenido por tipo.
3. Verificar hub: `/club-de-lectura/:slug/investigacion`.

---

## API (resumen)

Prefijo: `/api/book_clubs/`

| Método | Path | Notas |
|--------|------|--------|
| GET/POST | `/` | Listar / crear (staff) |
| GET/PATCH | `/<slug>/` | Detalle / editar |
| POST | `/<slug>/join/` | Membresía |
| GET | `/<slug>/hub/` | Payload agregado del hub |
| GET/POST/DELETE | `/<slug>/events/` | Listar / vincular / desvincular (`event_id`) |
| GET/POST | `/<slug>/discussion-questions/` | Debates |
| GET/PATCH/DELETE | `/<slug>/discussion-questions/<id>/` | |
| GET/PATCH | `/<slug>/membership/introduction/` | Preséntate → Profile |
| GET | `/<slug>/members/` | Roster; `?include_all=1` para gestores |
| PATCH | `/<slug>/members/<membership_id>/` | Cambiar rol |
| POST | `/<slug>/guest-access/` | Gate por email |
| GET | `/invite-preview/` | Preview token invitación |

Comentarios de debate: `/api/comments/discussion-question/<id>/`.

---

## Frontend key files

| Área | Archivos |
|------|----------|
| Layout / nav hub | `BookClubLayout.jsx` |
| Tabs | `BookClubOverview`, `BookClubMissions`, `DiscussionQuestions*`, `BookClubCommunity`, `BookClubInvestigation`, `BookClubMeetings`, `BookClubIntroduction` |
| API client | `frontend/src/api/bookClubsApi.js` |
| Admin | `admin/BookClubAdmin*.jsx` |
| Timeline reusado | `frontend/src/topics/timeline/TopicTimeline.jsx` |

---

## Tests

```bash
cd acbc_app && . .venv/bin/activate
ENVIRONMENT=DEVELOPMENT python manage.py test book_clubs -v 1
```

Cubre hub, join, debates, schedule, guest (según suite), presentación/Profile, roster, unlink events y roles (si están en la branch).

---

## Decisiones de producto (recordatorio)

1. El club **orquesta**; no duplica paths/topics/events.
2. Preséntate actualiza el **perfil global**, no una bio paralela.
3. Investigación embebe el timeline; el detalle completo del tema abre en otra pestaña.
4. Debates ≠ quizzes; respuestas públicas visibles para la cohorte.
