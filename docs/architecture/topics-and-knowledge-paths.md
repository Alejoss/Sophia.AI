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
- `created_at`, `updated_at` (`DateTimeField`): metadatos temporales.
- `moderators` (`ManyToManyField(User)`): usuarios con permisos de moderación sobre el tema.
- `related_topics` (`ManyToManyField('self')`): relación dirigida con otros temas relacionados.

**Relaciones con otros modelos**:

- `Content.topics` (`ManyToManyField('Topic', related_name='contents')`): relaciona contenido con uno o varios temas.
- `ContentSuggestion` y `TopicModeratorInvitation` enlazan usuarios y temas para moderación y propuestas de contenido.

Modelos relacionados:

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
    - Devuelve todos los temas como lista de `TopicBasicSerializer`.
  - `POST /topics/` → `TopicView.post`
    - Crea un nuevo tema.
    - `creator` se define automáticamente desde `request.user`.

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

- `createTopic(topicData)` → `POST /content/topics/`
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
  - Formulario para crear nuevos temas (título, descripción, imagen).
  - Usa `contentApi.createTopic`.

- `TopicEdit.jsx`
  - Edición de metadatos de un tema: título, descripción, imagen, moderadores, sugerencias.
  - Usa:
    - `contentApi.getTopicDetails` (carga inicial).
    - `contentApi.updateTopic` y `updateTopicImage`.
    - `TopicModerators` y `ContentSuggestionsManager`.
  - Solo el creador ve y gestiona la sección de moderadores; creador/moderadores ven la gestión de sugerencias de contenido.

- `TopicList.jsx`
  - Lista de temas disponibles para el usuario (normalmente usando `getTopics` o `getUserTopics`).

- `TopicDetail.jsx`
  - Muestra un tema concreto, su imagen, descripción y contenidos destacados por tipo de media.
  - Integra detalles de contenido (votos, media, etc.).

- `TopicAddContent.jsx` y `TopicEditContent.jsx`
  - Pantallas para agregar o quitar contenido al tema, usando `getTopicDetailsSimple`, `addContentToTopic` y `removeContentFromTopic`.

- `TopicContentMediaType.jsx`
  - Muestra contenido de un tema filtrado por tipo (`VIDEO`, `AUDIO`, `TEXT`, `IMAGE`) utilizando `getTopicContentByType`.

- `TopicModerators.jsx`
  - Gestión de moderadores del tema: búsqueda de usuarios, envío de invitaciones, aceptación/rechazo, y eliminación de moderadores.

- `ContentSuggestionsManager.jsx`, `ContentSuggestionModal.jsx`, `TopicContentSuggestionsPage.jsx`, `MyContentSuggestions.jsx`
  - Flujo completo de sugerencias de contenido:
    - Usuarios sugieren contenido para un tema.
    - Creador/moderadores revisan, aceptan, rechazan o marcan como duplicado.

Rutas relevantes en `App.jsx` (prefijo `/content` enrutado a un layout protegido):

- `/content/create_topic` → `TopicCreationForm`
- `/content/topics` → `TopicList`
- `/content/topics/:topicId` → `TopicDetail`
- `/content/topics/:topicId/edit` → `TopicEdit`
- `/content/topics/:topicId/add-content` → `TopicAddContent`
- `/content/topics/:topicId/edit-content` → `TopicEditContent`
- `/content/topics/:topicId/suggestions` → `TopicContentSuggestionsPage`
- `/content/topics/:topicId/:mediaType` → `TopicContentMediaType`

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

