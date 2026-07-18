## Topics y Knowledge Paths – Visión General

Este documento describe cómo están modelados e implementados en el sistema los **Topics (temas)** y los **Knowledge Paths (caminos de conocimiento)**, tanto en el backend (Django) como en el frontend (React), y cómo se relacionan con otros componentes de la plataforma.

- **Topics**: categorías curadas por usuarios (normalmente docentes) donde se agrupa contenido y se realiza moderación colaborativa.
- **Knowledge Paths**: rutas de aprendizaje estructuradas en pasos (`Node`) que utilizan contenido existente y permiten seguimiento de progreso.

---

## Topics

### Modelo de dominio

Backend: `content/models.py` → modelo `Topic`.

**Propósito**: agrupar contenido educativo bajo un tema concreto, con soporte para moderadores, invitaciones y sugerencias de contenido.

**Campos principales de `Topic`**:

- `title` (`CharField(200)`): título del tema.
- `description` (`TextField`): descripción del tema.
- `creator` (`ForeignKey(User)`): usuario que creó el tema.
- `topic_image` (`ImageField`, `upload_to=topic_image_path`): imagen de portada del tema.
- `is_public` (`BooleanField`, default `True`): si es `False`, el tema no aparece en listados públicos ni en búsqueda.
- `activity_score` (`IntegerField`, default `0`, indexado): ranking cacheado para ordenar el listado público. Se actualiza por deltas en eventos (contenido, likes, comentarios, timeline); recálculo completo solo con el comando de management.
- `created_at`, `updated_at` (`DateTimeField`): metadatos temporales.
- `moderators` (`ManyToManyField(User)`, `blank=True`): usuarios con permisos de moderación sobre el tema.
- `related_topics` (`ManyToManyField('self')`): relación dirigida con otros temas relacionados.

**Fórmula de `activity_score`:**

```text
score =
  (contenidos * 10)
+ (likes positivos en contenidos del tema * 3)
+ (comentarios activos con topic_id * 5)
+ (¿tiene ≥1 entrada de timeline? 50 : 0)
```

Actualización incremental en caliente (`UPDATE … activity_score = activity_score + delta`). Tras migrar, backfill una vez:

```bash
python manage.py recompute_topic_activity_scores
python manage.py recompute_topic_activity_scores --topic-id 42
```

**Relaciones con otros modelos**:

- `Content.topics` (`ManyToManyField('Topic', related_name='contents')`): relaciona contenido con uno o varios temas.
- `ContentSuggestion` y `TopicModeratorInvitation` enlazan usuarios y temas para moderación y propuestas de contenido.

Modelos relacionados:

- `TopicCreationRequest`
  - Propósito: solicitud previa de un usuario para crear un tema; el administrador revisa título y descripción antes de permitir la creación.
  - Campos clave: `requested_by`, `proposed_title`, `proposed_description`, `approved_title`, `approved_description`, `status (PENDING/APPROVED/REJECTED/COMPLETED/CANCELLED)`, `reviewed_by`, `rejection_reason`, `topic` (FK opcional al tema creado).
  - Invariantes:
    - Un usuario puede tener hasta 3 solicitudes `PENDING` a la vez.
    - Solo solicitudes `APPROVED` permiten `POST /topics/` con `creation_request_id` (flujo legacy).
    - Tras la aprobación admin, el tema se crea automáticamente y la solicitud pasa a `COMPLETED`.
    - El solicitante puede cancelar (`CANCELLED`) solo solicitudes `PENDING`.

- `TopicModeratorInvitation`
  - Controla invitaciones de moderador: `topic`, `invited_user`, `invited_by`, `status (PENDING/ACCEPTED/DECLINED/CANCELLED)`, `message`.
  - Invariantes:
    - `unique_together = ['topic', 'invited_user']`.
    - Métodos de dominio: `accept()` añade al usuario como moderador y marca la invitación como `ACCEPTED`, `decline()` marca `DECLINED`.

- `ContentSuggestion`
  - Propósito: proponer contenido existente para que sea añadido a un tema.
  - Campos clave: `topic`, `content`, `suggested_by`, `reviewed_by`, `status (PENDING/ACCEPTED/REJECTED)`, `message`, `rejection_reason`, `is_duplicate`.
  - Invariantes:
    - `unique_together = ['topic', 'content', 'suggested_by']`.
    - Índices en `['topic', 'status']` y `['suggested_by', 'status']` para filtros habituales.

Métodos de ayuda:

- `Topic.is_moderator_or_creator(user)`: devuelve `True` si el usuario es el creador del tema o uno de sus moderadores (se usa en vistas para control de permisos).

---

### API backend para Topics

Backend: `acbc_app/content/urls.py` y `acbc_app/content/views.py` (sección “Topic Views”).

Todas las vistas de Topics requieren autenticación (`IsAuthenticated`), y algunas añaden reglas de autor/moderador a nivel de lógica.

**Endpoints principales** (prefijo `/content/` omitido en URLs relativas):

- **Listado y creación de temas**
  - `GET /topics/` → `TopicView.get`
    - Devuelve temas públicos (`is_public=True`) ordenados por `-activity_score`, luego `-created_at`, como lista de `TopicBasicSerializer`.
  - `POST /topics/` → `TopicView.post`
    - Crea un nuevo tema.
    - `creator` se define automáticamente desde `request.user`.
    - **Usuarios normales**: requieren `creation_request_id` de una `TopicCreationRequest` en estado `APPROVED` que les pertenezca. El título y la descripción se toman de la solicitud aprobada (no del body).
    - **Staff (`is_staff`)**: pueden crear temas directamente sin solicitud previa.
    - Al crear el tema desde una solicitud aprobada, la solicitud pasa a `COMPLETED` y se vincula al `Topic` creado.

- **Solicitudes de creación de tema**
  - `GET /topic-creation-requests/` → `TopicCreationRequestListCreateView.get`
    - Lista las solicitudes del usuario autenticado (filtro opcional `?status=`).
  - `POST /topic-creation-requests/` → `TopicCreationRequestListCreateView.post`
    - Envía una solicitud con `proposed_title` y `proposed_description`.
    - Hasta 3 solicitudes `PENDING` por usuario a la vez.
    - Notifica a los usuarios staff y envía correo a administradores.
  - `POST /topic-creation-requests/<id>/cancel/` → `TopicCreationRequestCancelView.post`
    - El solicitante cancela su propia solicitud si está `PENDING` (pasa a `CANCELLED`).
  - `GET /admin/topic-creation-requests/` → `AdminTopicCreationRequestsView.get` (**solo staff**)
    - Lista todas las solicitudes (filtro opcional `?status=`).
  - `POST /admin/topic-creation-requests/<id>/approve/` → `AdminTopicCreationRequestApproveView.post` (**solo staff**)
    - Aprueba con `approved_title` y `approved_description` (editables) y **publica el tema de inmediato** (`COMPLETED`).
  - `POST /admin/topic-creation-requests/<id>/finalize/` → `AdminTopicCreationRequestFinalizeView.post` (**solo staff**)
    - Publica el tema de solicitudes legacy en `APPROVED` sin `topic` vinculado.
  - `POST /admin/topic-creation-requests/<id>/reject/` → `AdminTopicCreationRequestRejectView.post` (**solo staff**)
    - Rechaza con `rejection_reason` opcional.

- **Detalle y actualización de tema**
  - `GET /topics/<pk>/` → `TopicDetailView.get`
    - Devuelve un `TopicDetailSerializer` con:
      - Datos básicos del tema.
      - Lista de contenidos asociados ordenados por votos y media type (IMAGE, TEXT, AUDIO, VIDEO).
      - Perfiles de contenido (`ContentProfile`) seleccionados preferentemente del creador del tema y, si no existen, del usuario actual.
  - `PATCH /topics/<pk>/` → `TopicDetailView.patch`
    - Actualiza el título, descripción o imagen del tema.
    - **Permiso**: solo `creator` o moderadores (`topic.is_moderator_or_creator(request.user)`).
    - Si se actualiza `topic_image`, elimina el fichero anterior en disco/S3 antes de guardar el nuevo.

- **Vista simple para gestión de contenido**
  - `GET /topics/<pk>/content-simple/` → `TopicContentSimpleView.get`
    - Devuelve:
      - Datos básicos del tema (`id`, `title`, `description`).
      - Lista de `ContentProfile` del usuario actual que están en ese tema.
    - Optimizado para pantallas de gestión (añadir/quitar contenido en un tema).

- **Vista básica de un tema**
  - `GET /topics/<pk>/basic/` → `TopicBasicView.get`
    - Devuelve `TopicBasicSerializer` (sin contenidos ni moderadores).

- **Añadir y quitar contenido de un tema**
  - `POST /topics/<pk>/content/` → `TopicEditContentView.post`
    - Request: `{"content_profile_ids": [ids...]}`.
    - Busca los `ContentProfile` que pertenecen al usuario logueado y añade los `Content` asociados al `Topic.contents`.
    - **Permiso**: solo `creator` o moderadores.
  - `PATCH /topics/<pk>/content/` → `TopicEditContentView.patch`
    - Request: `{"content_ids": [ids...]}`.
    - Quita los `Content` indicados de `topic.contents`.
    - **Permiso**: solo `creator` o moderadores.

- **Moderadores**
  - `POST /topics/<pk>/moderators/` → `TopicModeratorsView.post`
    - Añade moderadores a un tema a partir de usernames.
    - **Permiso**: solo el `creator`.
  - `DELETE /topics/<pk>/moderators/` → `TopicModeratorsView.delete`
    - Elimina moderadores.
    - **Permiso**: solo el `creator`.
  - Flujo de invitaciones:
    - `POST /topics/<pk>/moderators/invite/`
    - `GET /topics/<pk>/moderators/invitations/`
    - `POST /topics/<pk>/moderators/invitations/<invitation_id>/accept/`
    - `POST /topics/<pk>/moderators/invitations/<invitation_id>/decline/`

- **Contenidos por tipo de media**
  - `GET /topics/<pk>/content/<media_type>/` → `TopicContentMediaTypeView`
    - Devuelve contenido del tema filtrado por media type (`VIDEO`, `AUDIO`, `TEXT`, `IMAGE`).

- **Topics del usuario e invitaciones**
  - `GET /user/topics/` → `UserTopicsView`
    - Lista de temas creados, moderados o relacionados con el usuario (respuesta estructurada por tipo).
  - `GET /user/topics/invitations/` → `UserTopicInvitationsView`
    - Lista de invitaciones de moderador para el usuario (filtrable por `status`).

- **Sugerencias de contenido**
  - `GET /topics/<pk>/content-suggestions/` → `TopicContentSuggestionsView`
  - `POST /topics/<pk>/content-suggestions/create/` → `TopicContentSuggestionCreateView`
  - `POST /topics/<pk>/content-suggestions/<suggestion_id>/accept/`
  - `POST /topics/<pk>/content-suggestions/<suggestion_id>/reject/`
  - `DELETE /topics/<pk>/content-suggestions/<suggestion_id>/`
  - Adicional: `/content/user/content-suggestions` para ver/gestionar sugerencias hechas por el usuario.

---

### Serializers de Topics

Backend: `acbc_app/content/serializers.py`.

- **`TopicBasicSerializer`**
  - Campos: `id`, `title`, `description`, `creator`, `topic_image`.
  - `topic_image` se renderiza como URL absoluta usando `build_media_url`.
  - Validación estricta de `title` (no se permite vacío o solo espacios).

- **`TopicDetailSerializer` (hereda de `TopicBasicSerializer`)**
  - Añade:
    - `contents`: `ContentWithSelectedProfileSerializer(many=True)`.
    - `moderators`: lista de `UserSerializer`.
  - El contexto incluye `selected_profiles` para que por cada `content` se use el perfil adecuado (creador del tema o usuario actual).

- **`TopicContentSerializer`**
  - Similar a `TopicDetailSerializer`, usado para vistas de gestión de contenido.

- **`TopicModeratorInvitationSerializer`**
  - Serializa invitaciones con información del tema y de los usuarios involucrados.

---

### Frontend – Topics

Frontend: `frontend/src/topics/*.jsx` y `frontend/src/api/contentApi.js`.

**API de frontend (`contentApi`) relevante**:

- `createTopic(topicData)` → `POST /content/topics/` (requiere `creation_request_id` si no es staff)
- `getTopicCreationRequests(filters)` → `GET /content/topic-creation-requests/`
- `createTopicCreationRequest(requestData)` → `POST /content/topic-creation-requests/`
- `cancelTopicCreationRequest(requestId)` → `POST /content/topic-creation-requests/<id>/cancel/`
- `getAdminTopicCreationRequests(filters)` → `GET /content/admin/topic-creation-requests/`
- `approveTopicCreationRequest(requestId, data)` → `POST /content/admin/topic-creation-requests/<id>/approve/`
- `rejectTopicCreationRequest(requestId, data)` → `POST /content/admin/topic-creation-requests/<id>/reject/`
- `getTopicDetails(topicId)` → `GET /content/topics/<id>/`
- `getTopicDetailsSimple(topicId)` → `GET /content/topics/<id>/content-simple/`
- `updateTopicImage(topicId, formData)` → `PATCH /content/topics/<id>/` (multipart).
- `updateTopic(topicId, topicData)` → `PATCH /content/topics/<id>/`
- `getTopics()` → `GET /content/topics/`
- `addContentToTopic(topicId, contentProfileIds)` → `POST /content/topics/<id>/content/`
- `removeContentFromTopic(topicId, contentIds)` → `PATCH /content/topics/<id>/content/`
- `getTopicContentByType(topicId, mediaType)` → `GET /content/topics/<id>/content/<mediaType>/`
- `getTopicBasicDetails(topicId)` → `GET /content/topics/<id>/basic/`
- Moderadores:
  - `addTopicModerators`, `removeTopicModerators`,
  - `inviteTopicModerator`, `getTopicModeratorInvitations`,
  - `acceptTopicModeratorInvitation`, `declineTopicModeratorInvitation`.
- Usuario y sugerencias:
  - `getUserTopics(type)`, `getUserTopicInvitations(status)`,
  - `createContentSuggestion`, `getTopicContentSuggestions`,
  - `acceptContentSuggestion`, `rejectContentSuggestion`, `deleteContentSuggestion`,
  - `getUserContentSuggestions`.

**Componentes principales de Topics** (carpeta `src/topics/`):

- `TopicCreationForm.jsx`
  - Formulario para **solicitar** la creación de un tema (título y descripción propuestos).
  - Muestra el historial de solicitudes del usuario y, si hay una aprobada, el botón **Crear tema**.
  - Usa `contentApi.createTopicCreationRequest` y `contentApi.createTopic` con `creation_request_id`.

- `TopicCreationRequestsAdmin.jsx`
  - Sección del dashboard de administrador para revisar solicitudes de creación de temas.
  - Permite aprobar (editando título/descripción) o rechazar con motivo.
  - Accesible en `/dashboard` (solo usuarios `is_staff`).

- `TopicEdit.jsx`
  - Hub unificado de edición del tema con pestañas en URL (`?tab=`):
    - `general` — título, descripción, imagen.
    - `content` — gestión de contenidos (`TopicContentManager`).
    - `timeline` — línea de tiempo en modo edición (`TopicTimeline` con `returnContext="edit"`).
    - `suggestions` — sugerencias de contenido y de entradas de timeline.
    - `moderators` — solo creador.
    - `danger` — eliminar tema, solo creador.
  - Usa `contentApi.getTopicDetails`, `updateTopic`, `updateTopicImage`, `TopicModerators`, `ContentSuggestionsManager`, `TimelineEntrySuggestionsManager`.

- `TopicContentManager.jsx`
  - Componente extraído para la pestaña **Contenido** del hub de edición: tabla, agregar/quitar, biblioteca y subida.

- `TopicEditContent.jsx`
  - Redirección legacy a `/content/topics/:topicId/edit?tab=content` (compatibilidad con enlaces antiguos).

- `TopicList.jsx`
  - Lista de temas disponibles para el usuario (normalmente usando `getTopics` o `getUserTopics`).

- `TopicDetail.jsx`
  - Muestra un tema concreto, su imagen, descripción y contenidos destacados por tipo de media.
  - Integra detalles de contenido (votos, media, etc.).

- `TopicAddContent.jsx`
  - Pantalla para agregar contenido al tema desde la vista pública; enlace a edición en pestaña **Contenido**.

- `TopicContentMediaType.jsx`
  - Muestra contenido de un tema filtrado por tipo (`VIDEO`, `AUDIO`, `TEXT`, `IMAGE`) utilizando `getTopicContentByType`.

- `TopicModerators.jsx`
  - Gestión de moderadores del tema: búsqueda de usuarios, envío de invitaciones, aceptación/rechazo, y eliminación de moderadores.

- `ContentSuggestionsManager.jsx`, `ContentSuggestionModal.jsx`, `TopicContentSuggestionsPage.jsx`, `MyContentSuggestions.jsx`
  - Flujo completo de sugerencias de contenido:
    - Usuarios sugieren contenido para un tema.
    - Creador/moderadores revisan, aceptan, rechazan o marcan como duplicado.

Rutas relevantes en `App.jsx` (prefijo `/content` enrutado a un layout protegido):

- `/content/create_topic` → `TopicCreationForm` (solicitud de creación)
- `/dashboard` → `Dashboard` (panel admin, solo staff; incluye solicitudes de temas)
- `/content/topics` → `TopicList`
- `/content/topics/:topicId` → `TopicDetail`
- `/content/topics/:topicId/edit` → `TopicEdit` (hub con `?tab=general|content|timeline|suggestions|moderators|danger`)
- `/content/topics/:topicId/add-content` → `TopicAddContent`
- `/content/topics/:topicId/edit-content` → redirección a `TopicEdit?tab=content`
- `/content/topics/:topicId/suggestions` → `TopicContentSuggestionsPage`
- `/content/topics/:topicId/:mediaType` → `TopicContentMediaType`

---

## Líneas de tiempo de tema (Topic Timelines)

### Propósito

Cada **Topic** puede tener una línea de tiempo editorial: una narrativa curada compuesta por **entradas ordenadas** que explican etapas, contexto o hitos del tema. Cada entrada puede vincular uno o varios contenidos ya asociados al tema (videos, audios, imágenes, textos), con un contenido marcado como **principal** y el resto como **referencia**.

La línea de tiempo se crea de forma implícita al agregar la primera entrada; no requiere un paso de configuración previo.

**Uso en Club de Lectura:** un `BookClub` puede vincular un `Topic` como tema de **Investigación**. El hub embebe el timeline en solo lectura y muestra conteos por tipo de media; el detalle completo del tema se abre en otra pestaña. Ver [book-clubs.md](book-clubs.md).

### Modelo de dominio

Backend: `content/models.py`.

**`TopicTimeline`** (relación 1:1 con `Topic`):

- `topic` — el tema al que pertenece.
- `title`, `description` — metadatos opcionales del contenedor (no editables desde la UI actual).
- `created_by`, `created_at`, `updated_at`.

**`TopicTimelineEntry`** (entradas de la narrativa):

- `timeline` — FK a `TopicTimeline`.
- `title` — obligatorio.
- `description` — texto narrativo opcional.
- `start_date`, `end_date` — fechas opcionales (`DateField`). Si `end_date` es anterior a `start_date`, la API rechaza la entrada.
- `order` — orden de visualización; se asigna automáticamente al crear y se actualiza con el endpoint de reordenado.
- `created_by`, `updated_by`, `created_at`, `updated_at`.

**`TopicTimelineEntryContent`** (vínculo entrada ↔ contenido):

- `entry`, `content` — relación con la entrada y un `Content` del tema.
- `order` — orden dentro de la entrada.
- `caption` — texto opcional (soportado por la API; la UI actual no lo expone).
- `unique_together = ['entry', 'content']` — un contenido no puede repetirse en la misma entrada.

**Reglas de validación**:

- Solo se pueden adjuntar contenidos que ya pertenecen al tema (`topic.contents`).
- No se puede adjuntar el mismo contenido dos veces en una entrada.
- El título de la entrada no puede estar vacío.

**Orden de las entradas** (`Meta.ordering`): `order`, `start_date`, `created_at`.

### Etiqueta de fecha en la UI

Al crear o editar una entrada, el formulario ofrece tres modos de referencia temporal:

| Modo | Campos | Uso típico |
|------|--------|------------|
| **Fecha concreta** (predeterminado en entradas nuevas) | Un `DatePicker` (día único) | Hitos puntuales (p. ej. publicación del whitepaper, 31 oct 2008) |
| **Periodo de tiempo** | `DatePicker` inicial + final opcional | Etapas con duración (p. ej. "2011–2013"); la fecha final puede quedar vacía si el periodo sigue abierto |
| **Sin fecha** | — | Etapas conceptuales (p. ej. "Período Jurásico"); se muestran como "Etapa N" |

Los selectores usan `@mui/x-date-pickers` con calendario y locale español (`TopicTimelineDateFields.jsx`).

Al mostrar la entrada (`TopicTimelineEntryCard`), la prioridad es:

1. Rango `start_date` – `end_date` (formato localizado, p. ej. `31 oct 2008 - 3 ene 2009`).
2. Solo `start_date`.
3. Sin fechas → **"Etapa N"** (según posición en la línea de tiempo).

### Permisos y visibilidad

| Acción | Quién |
|--------|-------|
| Ver línea de tiempo (`GET`) | Cualquier usuario autenticado |
| Crear, editar, eliminar entradas; reordenar | Creador del tema o moderadores (`topic.is_moderator_or_creator`) |

**Pestaña en el frontend** (`TopicDetail.jsx`):

- Visible si el usuario es creador/moderador **o** si la línea de tiempo tiene al menos una entrada.
- Los visitantes autenticados ven la pestaña solo cuando ya hay contenido publicado en la línea de tiempo.

### API backend

Backend: `acbc_app/content/urls.py`, `acbc_app/content/views.py`, `acbc_app/content/serializers.py`.

Prefijo: `/content/topics/<pk>/timeline/`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/topics/<pk>/timeline/` | Devuelve la línea de tiempo con todas las entradas y contenidos. Si no existe, responde con `entries: []` y metadatos vacíos (200). |
| `POST` | `/topics/<pk>/timeline/` | Crea una entrada (y la línea de tiempo si es la primera). |
| `PATCH` | `/topics/<pk>/timeline/<entry_id>/` | Actualiza una entrada existente. |
| `DELETE` | `/topics/<pk>/timeline/<entry_id>/` | Elimina una entrada. |
| `POST` | `/topics/<pk>/timeline/reorder/` | Reordena todas las entradas. |

**Ejemplo — crear entrada**:

```json
POST /content/topics/42/timeline/
{
  "title": "Publicación del Whitepaper de Bitcoin",
  "description": "Satoshi Nakamoto publica el whitepaper...",
  "start_date": "2008-10-31",
  "end_date": null,
  "contents": [
    { "content_id": 101, "order": 1 },
    { "content_id": 102, "order": 2 }
  ]
}
```

**Ejemplo — reordenar**:

```json
POST /content/topics/42/timeline/reorder/
{
  "entry_ids": [15, 12, 14]
}
```

La lista `entry_ids` debe incluir **exactamente** todos los IDs de entradas de la línea de tiempo, en el orden deseado.

**Perfiles de contenido en la respuesta**: al serializar, cada `content` incluye el `ContentProfile` preferido del creador del tema o, si no existe, del usuario que consulta (`get_topic_content_profile_for_display`).

### Frontend

Carpeta: `frontend/src/topics/timeline/`.

| Componente | Rol |
|------------|-----|
| `TopicTimeline.jsx` | Contenedor: carga, listado, reordenado y navegación a crear/editar |
| `TopicTimelineEntryPage.jsx` | Página de creación/edición (permisos, guardado, breadcrumbs) |
| `TopicTimelineEntryForm.jsx` | Formulario reutilizable (título, descripción, fechas, contenidos) |
| `TopicTimelineDateFields.jsx` | Selector de fecha con calendario y modos: sin fecha, fecha concreta, periodo |
| `TopicTimelineEntryCard.jsx` | Tarjeta visual con línea vertical, chip de fecha y previews |
| `TopicTimelineContentSelector.jsx` | Selector de contenidos del tema con búsqueda, filtro por tipo y orden |
| `TopicTimelineContentPreview.jsx` | Vista previa de un contenido vinculado |
| `TopicTimelineEntrySuggestionPage.jsx` | Página para sugerir una entrada narrativa nueva |
| `TopicTimelineEntryContentSuggestionPage.jsx` | Página para sugerir contenido a una entrada existente |
| `TimelineEntrySuggestionsManager.jsx` | Moderación de sugerencias de entradas nuevas |
| `TimelineEntryContentSuggestionsManager.jsx` | Moderación de sugerencias de vínculo contenido ↔ entrada |

Integración en `TopicDetail.jsx`: pestaña **"Línea de tiempo"** que renderiza `<TopicTimeline topicId={...} canEdit={...} canSuggest={...} />`.

Rutas de formulario (página completa, no modal):

- `/content/topics/:topicId/timeline/new` — nueva entrada (moderador)
- `/content/topics/:topicId/timeline/:entryId/edit` — editar entrada (moderador)
- `/content/topics/:topicId/timeline/suggest` — sugerir entrada nueva (comunidad)
- `/content/topics/:topicId/timeline/:entryId/suggest-content` — sugerir contenido para una entrada (comunidad)
- Tras guardar o sugerir → `/content/topics/:topicId?tab=timeline`

Documentación detallada:

- [Sugerir entrada en la línea de tiempo](topic-timeline-entry-suggestions-plan.md)
- [Sugerir contenido para una entrada](topic-timeline-entry-content-suggestions.md)

### Sugerencias de la comunidad (línea de tiempo)

Tres flujos complementarios en la pestaña **Línea de tiempo**:

| Acción | UI | Ruta |
|--------|-----|------|
| Sugerir entrada nueva | Botón **Sugerir entrada** (cabecera) | `/timeline/suggest` |
| Sugerir contenido a entrada | Ícono bombilla al expandir tarjeta | `/timeline/:entryId/suggest-content` |
| Moderar todo | **Editar tema → Sugerencias** | `/edit?tab=suggestions` |

El badge de pendientes en **Editar tema** cuenta sugerencias de contenido al tema, de entradas nuevas y de vínculos a entradas.

**API de frontend** (`contentApi.js`):

- `getTopicTimeline(topicId)`
- `createTopicTimelineEntry(topicId, entryData)`
- `updateTopicTimelineEntry(topicId, entryId, entryData)`
- `deleteTopicTimelineEntry(topicId, entryId)`
- `reorderTopicTimeline(topicId, entryIds)`
- `createTopicTimelineEntrySuggestion(topicId, payload)`
- `getTopicTimelineEntrySuggestions(topicId, filters)`
- `createTopicTimelineEntryContentSuggestion(topicId, entryId, payload)`
- `getTopicTimelineEntryContentSuggestions(topicId, filters)`

Los contenidos disponibles para adjuntar se obtienen con `getTopicDetailsSimple(topicId)` (perfiles del usuario en ese tema).

### Tests

Backend: `acbc_app/content/tests.py`:

- **Timeline CRUD**: crear entrada, listar, adjuntar contenidos, reordenar, permisos.
- **`TopicTimelineEntrySuggestionsAPITests`**: sugerencias de entradas nuevas.
- **`TopicTimelineEntryContentSuggestionsAPITests`**: sugerencias de vínculo contenido ↔ entrada (incluye reutilización del mismo contenido en varias entradas).

```bash
docker compose exec backend python manage.py test content.tests.TopicTimelineEntryContentSuggestionsAPITests -v 1
```

---

## Knowledge Paths

### Modelo de dominio

Backend: `knowledge_paths/models.py`.

**Objetivo**: representar un camino de aprendizaje estructurado compuesto por nodos (`Node`) que referencian contenido existente, con seguimiento de progreso y visibilidad controlada.

**Modelo `KnowledgePath`**:

- `title` (`CharField(200)`): nombre del camino.
- `description` (`TextField`): descripción general.
- `author` (`ForeignKey(User, related_name='created_paths')`): creador del camino.
- `image` (`ImageField`, `upload_to=upload_knowledge_path_image`): imagen de portada.
- `is_visible` (`BooleanField`): indica si el camino es visible para otros usuarios.
- `created_at`, `updated_at` (`DateTimeField`).

Comportamiento:

- `can_be_visible()`:
  - Devuelve `True` solo si el camino tiene al menos **2 nodos**.
- `ensure_visibility_consistency()`:
  - Si `is_visible` es `True` pero el camino no cumple `can_be_visible`, fuerza `is_visible=False`.
  - Se llama desde `Node.save()` y `Node.delete()` para mantener la invariancia.
- `save()`:
  - Gestiona imágenes temporales (`temp_...`) y las mueve a su ruta final cuando el objeto ya tiene `id`.
- Votación:
  - `vote_count` y `get_user_vote(user)` consultan `VoteCount` y `Vote` usando `ContentType`.

**Modelo `Node`**:

- Campos:
  - `knowledge_path` (`ForeignKey(KnowledgePath, related_name='nodes')`).
  - `content_profile` (`ForeignKey(ContentProfile, null=True, blank=True)`): qué contenido concreto se utiliza en este paso.
  - `title`, `description`.
  - `order` (`PositiveIntegerField`): orden del nodo en el camino.
  - `media_type` (choices: `VIDEO`, `AUDIO`, `TEXT`, `IMAGE`).
  - `created_at`, `updated_at`.
- Invariantes:
  - `ordering = ['order']`.
  - `unique_together = ['knowledge_path', 'order']`.
- Comportamiento:
  - `save()`:
    - Si `order` no está definido, asigna el siguiente disponible (último + 1).
    - Llama a `knowledge_path.ensure_visibility_consistency()` después de guardar.
  - `delete()`:
    - Vuelve a comprobar visibilidad consistente en el camino asociado.
  - Métodos de navegación: `get_preceding_node()`, `get_next_node()`.

**Seguimiento de progreso**:

- Modelo `UserNodeCompletion` en `profiles/models.py`.
  - Campos: `user`, `knowledge_path`, `node`, `is_completed`, `completed_at`.
  - `unique_together = (user, knowledge_path, node)`.
  - Usado por los servicios de progreso (`get_knowledge_path_progress`) y por los endpoints de completar nodos.

---

### API backend para Knowledge Paths

Backend: `acbc_app/knowledge_paths/views.py` y `acbc_app/knowledge_paths/urls.py`.

Permisos generales:

- Creación, edición, nodos y acciones de progreso requieren autenticación (`IsAuthenticated`) salvo se indique lo contrario.
- Algunos endpoints de lectura permiten acceso anónimo (p.ej. ver detalles de un camino o de un nodo).

**Endpoints principales** (prefijo `/knowledge_paths/`):

- **Creación de caminos**
  - `POST /create/` → `KnowledgePathCreateView.post`
    - Crea un camino (con o sin imagen).
    - `author` se infiere de `request.user`.
    - Valida y fuerza `is_visible=False` en la creación; la visibilidad se controla luego en actualizaciones.

- **Listado de caminos visibles**
  - `GET /` → `KnowledgePathListView.get`
    - Pagina (`page`, `page_size`) sobre caminos **visibles** (`is_visible=True`) ordenados por `created_at` descendente.
    - Añade al serializer:
      - `_vote_count` y `_user_vote` precalculados.
      - Campo `can_be_visible` según el número de nodos.

- **Caminos del usuario**
  - `GET /my/` → `UserKnowledgePathsView.get`
    - Lista caminos creados por el usuario autenticado (visibles o no).
  - `GET /engaged/` → `UserEngagedKnowledgePathsView.get`
    - Caminos en los que el usuario ha completado al menos un nodo.
    - Excluye caminos creados por el propio usuario.
  - `GET /user/<user_id>/` → `UserKnowledgePathsByUserIdView.get`
    - Caminos **visibles** creados por un usuario específico (para mostrar en su perfil o vista pública).

- **Detalle y actualización de un camino**
  - `GET /<pk>/` → `KnowledgePathDetailView.get`
    - Permite acceso anónimo para ver el detalle del camino (título, descripción, nodos, progreso si el usuario está autenticado).
  - `PUT /<pk>/` → `KnowledgePathDetailView.put`
    - Actualización completa de un camino.
    - **Permiso**: requiere autenticación y que `knowledge_path.author == request.user`.
    - Gestiona actualización de imagen y visibilidad (`is_visible`), aplicando la regla de “mínimo 2 nodos para ser visible”.

- **Detalle básico**
  - `GET /<pk>/basic/` → `KnowledgePathBasicDetailView.get`
    - Devuelve información básica (`KnowledgePathBasicSerializer`), sin nodos ni progreso.

- **Nodos**
  - `POST /<path_id>/nodes/` → `NodeCreateView.post`
    - Crea un nodo asociado a un `ContentProfile`.
    - Deriva `media_type` del contenido asociado.
  - `DELETE /<path_id>/nodes/<node_id>/` → `NodeDeleteView.delete`
    - Elimina un nodo (opcionalmente se puede restringir a autor).
  - `GET /<path_id>/nodes/<node_id>/` → `NodeDetailView.get`
    - Permite acceso anónimo para ver un nodo concreto, incluyendo flags `is_available` e `is_completed` si el usuario está autenticado.
  - `POST /<path_id>/nodes/<node_id>/` → `NodeDetailView.post`
    - Marca un nodo como completado para el usuario actual (`UserNodeCompletion`).
    - Valida que el nodo esté disponible para el usuario (`is_node_available_for_user`).
  - `PUT /<path_id>/nodes/<node_id>/` → `NodeDetailView.put`
    - Actualización de un nodo; solo el autor del `KnowledgePath` puede modificarlo.
    - Permite cambiar el `content_profile` y, en consecuencia, el `media_type`.
  - `DELETE /<path_id>/nodes/<node_id>/` → `NodeDetailView.delete`
    - Eliminación de nodo; requiere autenticación y que el usuario sea el autor del camino.
  - Reordenación de nodos:
    - `PUT /<path_id>/nodes/reorder/` → `NodeReorderView.put`
    - Request: `{"node_orders": [{"id": <node_id>, "order": <nuevo_orden>}, ...]}`
    - Usa una transacción atómica y reordena en dos pasos para evitar conflictos.

---

### Serializers de Knowledge Paths

Backend: `acbc_app/knowledge_paths/serializers.py`.

- **`KnowledgePathSerializer`**
  - Incluye:
    - `nodes` (`NodeSerializer`).
    - `progress` (estructura con `completed_nodes`, `total_nodes`, `percentage`, `is_completed`).
    - `author`, `author_id`.
    - `vote_count`, `user_vote`, `image`, `is_visible`, `can_be_visible`.

- **`KnowledgePathCreateSerializer`**
  - Usado para creación y actualización.
  - Aplica reglas:
    - Nuevos caminos se crean con `is_visible=False`.
    - En `update`, validar que `is_visible=True` solo si `can_be_visible()` es cierto (mínimo 2 nodos).
  - Renderiza `image` como URL absoluta.

- **`KnowledgePathListSerializer`** y **`KnowledgePathEngagedSerializer`**
  - Versiones simplificadas para listados (públicos, del usuario y “engaged”).

- **`NodeSerializer`**
  - Campos: `id`, `title`, `description`, `order`, `media_type`, `is_available`, `is_completed`, `content_profile_id`, `quizzes`.
  - `is_available` e `is_completed` se calculan en función del usuario actual y reglas de negocio (`is_node_available_for_user`, `is_node_completed_by_user`).

---

### Frontend – Knowledge Paths

Frontend: `frontend/src/knowledgePaths/*.jsx` y `frontend/src/api/knowledgePathsApi.js`.

**API de frontend (`knowledgePathsApi`)**:

- Caminos:
  - `createKnowledgePath(data)` → `POST /knowledge_paths/create/` (JSON o `FormData` si hay imagen).
  - `getKnowledgePath(pathId)` → `GET /knowledge_paths/<id>/`.
  - `updateKnowledgePath(pathId, data)` → `PUT /knowledge_paths/<id>/` (JSON o `FormData`).
  - `getKnowledgePaths(page, pageSize)` → `GET /knowledge_paths/`.
  - `getUserKnowledgePaths(page, pageSize)` → `GET /knowledge_paths/my/`.
  - `getUserEngagedKnowledgePaths(page, pageSize)` → `GET /knowledge_paths/engaged/`.
  - `getUserKnowledgePathsById(userId, page, pageSize)` → `GET /knowledge_paths/user/<userId>/`.
  - `getKnowledgePathBasic(pathId)` → `GET /knowledge_paths/<id>/basic/`.

- Nodos:
  - `addNode(pathId, nodeData)` → `POST /knowledge_paths/<pathId>/nodes/`.
  - `removeNode(pathId, nodeId)` → `DELETE /knowledge_paths/<pathId>/nodes/<nodeId>/`.
  - `getNode(pathId, nodeId)` → `GET /knowledge_paths/<pathId>/nodes/<nodeId>/`.
  - `updateNode(pathId, nodeId, nodeData)` → `PUT /knowledge_paths/<pathId>/nodes/<nodeId>/`.
  - `reorderNodes(pathId, nodeOrders)` → `PUT /knowledge_paths/<pathId>/nodes/reorder/`.
  - `markNodeCompleted(pathId, nodeId)` → `POST /knowledge_paths/<pathId>/nodes/<nodeId>/`.
  - `getNodeContent(contentProfileId)` → `GET /content/content-profiles/<id>/detail/`.

**Componentes principales de Knowledge Paths**:

- `KnowledgePathCreationForm.jsx`
  - Creación/edición de caminos con portada (imagen), título, descripción y visibilidad.

- `KnowledgePathList.jsx`
  - Grid paginado de caminos visibles (landing de caminos).

- `KnowledgePathDetail.jsx`
  - Muestra un camino concreto, su progreso, nodos y acciones para completar nodos.

- `KnowledgePathEdit.jsx`
  - Edición de metadatos de un conocimiento (título, descripción, visibilidad, imagen).

- `KnowledgePathsUser.jsx`
  - Pestañas para:
    - Caminos creados por el usuario.
    - Caminos donde el usuario está comprometido (“engaged”).

- `KnowledgePathsByUser.jsx`
  - Vista de caminos visibles creados por otro usuario (por ejemplo, desde su perfil).

- `NodeCreate.jsx`, `NodeEdit.jsx`, `NodeDetail.jsx`
  - Gestión de nodos individuales:
    - Crear, editar, ver detalles, marcar como completados.
    - Utilizan `content_profile_id` para conectar con contenido existente.

---

## Resumen

- **Topics** proporcionan una capa de categorización y curación colaborativa sobre el contenido, con soporte de moderadores e invitaciones, y flujos de sugerencias de contenido.
- **Knowledge Paths** construyen rutas de aprendizaje sobre ese contenido, con nodos ordenados, reglas de visibilidad (mínimo 2 nodos), votaciones y seguimiento de progreso por usuario.
- Ambos conceptos están bien integrados con el sistema de votos, notificaciones, certificados y con el frontend de React mediante APIs específicas (`contentApi` y `knowledgePathsApi`).

