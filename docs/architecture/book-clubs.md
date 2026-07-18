# Club de Lectura (Book Clubs)

Este documento describe el **Club de Lectura** como capa de producto sobre Knowledge Paths, Topics, Events y Comments: hub con temporalidad, misiones, foro, comunidad, investigación y administración desde el dashboard.

## Objetivo

Acompañar un ciclo de lectura en cohorte sin duplicar los primitivos de la plataforma:

| Necesidad del club | Reutiliza |
|--------------------|-----------|
| Misiones / capítulos | `KnowledgePath` + `Node` + `UserNodeCompletion` + `BookClubMissionRelease` |
| Investigación (timeline + biblioteca) | `Topic` + `TopicTimeline` + `Content` |
| Reuniones en vivo | `Event` + `BookClubEvent` |
| Foro guiado | `DiscussionQuestion` + `Comment` (GFK) |
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

- Representa pertenencia al club y metadatos de presentación; no asigna permisos ni roles.
- `intro_updated_at` — el miembro completó **Preséntate** en este club
- Espejos legacy: `intro_description`, `social_url`, `additional_url`  
  **Fuente de verdad de la bio:** `Profile.profile_description` y `Profile.external_url`.  
  `additional_url` es opcional y solo del club.

**Se presentó** ⇔ `intro_updated_at IS NOT NULL`.

La migración `0006_remove_bookclubmembership_role` eliminó `role`. La gestión se detecta
exclusivamente con `User.is_staff` / `User.is_superuser`; no existe una designación
mentor/admin por club.

### `BookClubEvent`

Une un `Event` existente al club (sin alterar el modelo `Event`).

### `BookClubMissionRelease`

Calendario colectivo del club: una fila por `(book_club, node)` con `opens_at`.

- Sin fecha (o futura) → la misión permanece bloqueada para miembros.
- Con `opens_at <= now` → se libera para todos; cada persona aún debe cumplir el nodo anterior.
- Staff puede previsualizar y completar sin esperar la fecha.
- CRUD vía `GET/PATCH /api/book_clubs/<slug>/mission-schedule/` (staff).

### `DiscussionQuestion`

Pregunta del foro (no es un `Quiz`).

- Ligada a `book_club`, opcionalmente a `node` (misión) y/o `event` (directo)
- `status`: `draft` \| `open` \| `closed`
- `opens_at` / `closes_at` — auto transición draft→open→closed
- Respuestas: `Comment` con GFK → `DiscussionQuestion`  
  Endpoint tipado: `/api/comments/discussion-question/<id>/`

El foro aplica **post-to-see**:

- Cada miembro puede publicar una sola respuesta de nivel superior por pregunta.
- Tras publicarla ve las respuestas de los demás y puede participar en sus hilos.
- El staff ve siempre todas las respuestas, sin publicar primero.
- El autor puede editar o eliminar su respuesta mediante los endpoints generales de comentarios.
- Eliminar la respuesta propia la deja inactiva y vuelve a bloquear las respuestas ajenas.

---

## Hub público (lectores)

Rutas bajo `/club-de-lectura/:slug/…` (`BookClubLayout` + outlet):

| Tab | Ruta | Contenido |
|-----|------|-----------|
| Inicio | `/` | Estado del ciclo, progreso, próxima misión, próximo directo, **Eco reciente** (comentarios abiertos del tema) |
| Misiones | `/misiones` | Nodos del knowledge path (respetando calendario colectivo) |
| Foro | `/foro`, `/foro/:id` | `DiscussionQuestion` + respuestas con post-to-see |
| Comunidad | `/comunidad` | Telegram + miembros presentados (+ atajo a Investigación) |
| **Investigación** | `/investigacion` | Tema vinculado: conteos VIDEO/IMAGE/AUDIO/TEXT + timeline embebido |
| Reuniones | `/reuniones` | Eventos del club |
| Preséntate | `/presentate` | Formulario de presentación (ruta auxiliar; no aparece en la nav principal) |

Landing waitlist / gate: `/club-de-lectura`.

Las rutas canónicas son `/club-de-lectura/:slug/foro` y
`/club-de-lectura/:slug/foro/:id`. Las rutas antiguas `/preguntas` y
`/preguntas/:id` existen únicamente como redirects.

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

- **Comunidad**: Telegram + personas presentadas.
- **Investigación**: narrativa y material del **tema** (timeline + conteos).
- **Eco reciente** (Inicio): previews de comentarios abiertos del tema vinculado (`topic_comment`). Las respuestas del foro no aparecen ahí (son post-to-see).

El roster público de Comunidad incluye únicamente membresías con
`intro_updated_at IS NOT NULL`. El staff puede solicitar el roster completo,
incluidas presentaciones pendientes, con `?include_all=1`; el parámetro no amplía
resultados para miembros normales.

---

## Acceso e onboarding

- **Guest email gate**: `POST /api/book_clubs/<slug>/guest-access/` → token firmado + email; header `X-Book-Club-Guest`.
- **Join**: `POST /api/book_clubs/<slug>/join/`.
- **Preséntate**: `GET/PATCH /api/book_clubs/<slug>/membership/introduction/`  
  Lee/escribe Profile; marca `intro_updated_at`.

---

## Dashboard admin (staff)

Base: `/dashboard/book-clubs/:slug/…`

| Sección | Qué editar |
|---------|------------|
| **General** | Título, descripción, Telegram, estado, fechas del ciclo, portada |
| **Conexiones** | Knowledge path (misiones) + **tema de Investigación**; vista previa de conteos y # entradas de timeline; atajos a editar path/timeline/contenido |
| **Misiones** | Fecha de apertura colectiva de cada nodo; las fechas deben respetar el orden del path |
| **Reuniones** | Vincular / desvincular `Event`s |
| **Foro** | CRUD de `DiscussionQuestion` (estado, misión, directo, schedule) |
| **Miembros** | Roster y estado de presentación; no asigna roles |

## Desbloqueo colectivo de misiones

Los caminos normales conservan su disponibilidad individual. Para miembros de un club,
`BookClubMissionRelease` agrega una segunda condición: el nodo solo está disponible si
ya llegó su `opens_at` **y** el usuario cumplió los prerrequisitos del nodo anterior.
Staff/superusers pueden previsualizar todas las misiones.

El backend resuelve el club aplicable por membresía aunque el cliente elimine `?club=`,
por lo que quitar el parámetro no permite saltar el calendario. Los no miembros siguen
usando el mismo Knowledge Path con su comportamiento normal.

Crear club: `/dashboard/book-clubs/nuevo` (staff).

La sección se muestra como **Foro** aunque su ruta interna de administración
continúa siendo `/dashboard/book-clubs/:slug/preguntas`.

Comando útil:

```bash
python manage.py create_book_club \
  --title "Club Cypherpunk" \
  --path-id <ID> \
  --topic-id <ID> \
  --username admin
```

Datos demo (miembros, presentaciones, misiones si el path está vacío, foro con respuestas, reuniones):

```bash
python manage.py populate_book_club
python manage.py populate_book_club --slug el-secuestro-de-bitcoin --members 8 --reset
```

Usuarios demo: `clubdemo_01`… con password `demo1234`. Reutiliza Topics / Knowledge Paths existentes.

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
| GET/PATCH | `/<slug>/mission-schedule/` | Calendario colectivo de misiones (staff) |
| GET/POST/DELETE | `/<slug>/events/` | Listar / vincular / desvincular; DELETE recibe `{ "event_id": N }` |
| DELETE | `/<slug>/events/<link_id>/` | Desvincular por id de `BookClubEvent` |
| GET/POST | `/<slug>/discussion-questions/` | Preguntas del foro |
| GET/PATCH/DELETE | `/<slug>/discussion-questions/<id>/` | |
| GET/PATCH | `/<slug>/membership/introduction/` | Preséntate → Profile |
| GET | `/<slug>/members/` | Presentados; staff puede usar `?include_all=1` |
| POST | `/<slug>/guest-access/` | Gate por email |
| GET | `/invite-preview/` | Preview token invitación |

Respuestas del foro: `GET/POST /api/comments/discussion-question/<id>/`.
La colección devuelve `[]` mientras el miembro no haya publicado su respuesta;
el staff siempre puede verla. Editar/eliminar la respuesta propia usa
`PATCH/DELETE /api/comments/<comment_id>/`.

---

## Frontend key files

| Área | Archivos |
|------|----------|
| Layout / nav hub | `BookClubLayout.jsx` |
| Tabs | `BookClubOverview`, `BookClubMissions`, `DiscussionQuestions*`, `BookClubCommunity`, `BookClubInvestigation`, `BookClubMeetings`, `BookClubIntroduction` |
| Retorno al club desde Knowledge Path | `BookClubReturnLink.jsx` (visible solo con `?club=` + membresía) |
| API client | `frontend/src/api/bookClubsApi.js` |
| Lista admin | `BookClubsDashboardAdmin.jsx` (tab del dashboard) |
| Admin por club | `admin/BookClubAdmin*.jsx` (General, Conexiones, Misiones, Reuniones, Foro, Miembros) |
| Timeline reusado | `frontend/src/topics/timeline/TopicTimeline.jsx` |

---

## Tests

```bash
cd acbc_app && . .venv/bin/activate
ENVIRONMENT=DEVELOPMENT python manage.py test book_clubs -v 1
```

Cubre hub, join, foro y post-to-see, schedule de preguntas, guest, presentación/Profile,
roster filtrado, permisos staff, desvincular eventos y calendario colectivo de misiones
(`BookClubMissionRelease`).

---

## Decisiones de producto (recordatorio)

1. El club **orquesta**; no duplica paths/topics/events.
2. Preséntate actualiza el **perfil global**, no una bio paralela.
3. Investigación embebe el timeline; el detalle completo del tema abre en otra pestaña.
4. Foro ≠ quizzes; las respuestas de la cohorte se desbloquean al publicar la propia.
5. Gestión del club = staff/superuser (sin roles por membresía).
6. Las misiones del club se liberan por calendario colectivo; el mismo path fuera del club
   conserva su regla secuencial individual.
