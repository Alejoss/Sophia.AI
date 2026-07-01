# Sugerir contenido para una entrada de la línea de tiempo

Documentación de la funcionalidad que permite a usuarios de la comunidad **vincular material existente a una entrada concreta** de la línea de tiempo de un tema, con revisión curatorial antes de publicar el vínculo.

Estado: **implementado**.

---

## Contexto: tres tipos de sugerencia en temas

| Tipo | Modelo | Qué propone el usuario |
|------|--------|------------------------|
| Contenido al tema | `ContentSuggestion` | Añadir material al catálogo del tema |
| Nueva entrada | `TopicTimelineEntrySuggestion` | Crear un hito narrativo nuevo |
| **Contenido a entrada existente** | `TopicTimelineEntryContentSuggestion` | Vincular material ya disponible a un hito concreto |

Este documento cubre el **tercer tipo**.

### Diferencia con editar la entrada (moderador)

Los moderadores adjuntan contenido directamente al editar una entrada (`TopicTimelineEntry` + `TopicTimelineEntryContent`). Las sugerencias de vínculo siguen el mismo patrón de moderación que `ContentSuggestion`: propuesta → revisión → aceptar/rechazar.

---

## Reglas de negocio

### Quién puede sugerir

- Usuario **autenticado** que **no** es creador ni moderador del tema.

### Contenido elegible

El contenido propuesto debe estar:

1. **En el tema** (`topic.contents`), o
2. **En la biblioteca del sugeridor** (`ContentProfile` del usuario).

No se exige que el contenido esté ya vinculado a la entrada ni que esté libre en otras entradas.

### Un contenido en varias entradas

**Sí está permitido.** El mismo `Content` puede vincularse a múltiples `TopicTimelineEntry` del mismo tema (p. ej. una imagen del genesis block en "Bloque Genesis" y también en "Whitepaper Lanzamiento").

La restricción `unique_together = ['entry', 'content']` en `TopicTimelineEntryContent` solo impide **duplicar el mismo par entrada+contenido** en la línea de tiempo publicada.

### Flag `is_duplicate`

Marcado en `true` cuando el contenido **ya está vinculado a esa misma entrada**. No bloquea el envío; informa al moderador. Al aceptar, no se crea un segundo vínculo.

### Campos de texto

| Campo | Dónde vive | Uso |
|-------|------------|-----|
| `message` | Sugerencia | Nota privada al moderador (no se publica) |
| `caption` | `TopicTimelineEntryContent` (publicado) | Solo al editar/aceptar vínculos publicados; la sugerencia no incluye caption |

### Al aceptar

1. Si el contenido **no** está en el tema → `topic.contents.add(content)`.
2. Si hay `ContentSuggestion` pendiente para el mismo contenido → se cierra como aceptada (`resolve_pending_content_suggestions_for_topic_content`).
3. Si el par entrada+contenido **no** existe aún → se crea `TopicTimelineEntryContent` con `order` al final y `caption` vacío.
4. La sugerencia pasa a `ACCEPTED` con `reviewed_by` y `reviewed_at`.

### Al rechazar

- `rejection_reason` obligatorio.
- Notificación al sugeridor.

---

## Modelo

### `TopicTimelineEntryContentSuggestion`

Ubicación: `acbc_app/content/models.py`. Migración: `0020_topictimelineentrycontentsuggestion`.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `topic` | FK `Topic` | Tema (denormalizado para consultas) |
| `entry` | FK `TopicTimelineEntry` | Entrada objetivo |
| `content` | FK `Content` | Contenido a vincular |
| `suggested_by` | FK `User` | Autor de la propuesta |
| `reviewed_by` | FK `User`, nullable | Moderador que revisó |
| `message` | Text | Nota al moderador |
| `rejection_reason` | Text | Motivo de rechazo |
| `status` | `PENDING` \| `ACCEPTED` \| `REJECTED` | Estado |
| `is_duplicate` | Boolean | Ya vinculado a esta entrada |
| `created_at`, `updated_at`, `reviewed_at` | DateTime | Auditoría |

**Invariantes:**

- `unique_together = ['entry', 'content', 'suggested_by']` — un usuario no puede tener dos sugerencias pendientes idénticas para la misma entrada.
- `entry` debe pertenecer al `topic` indicado (validado en serializer).

---

## API

Prefijo base: `/api/content/`.

| Método | Ruta | Quién | Descripción |
|--------|------|-------|-------------|
| `POST` | `/topics/<pk>/timeline/<entry_id>/content-suggestions/create/` | Usuario no moderador | Crear sugerencia |
| `GET` | `/topics/<pk>/timeline-entry-content-suggestions/` | Autenticado | Listar del tema (`?status=`, `?entry_id=`) |
| `POST` | `/topics/<pk>/timeline-entry-content-suggestions/<id>/accept/` | Creador o moderador | Aceptar y publicar vínculo |
| `POST` | `/topics/<pk>/timeline-entry-content-suggestions/<id>/reject/` | Creador o moderador | Rechazar (razón obligatoria) |
| `DELETE` | `/topics/<pk>/timeline-entry-content-suggestions/<id>/` | Solo el sugeridor | Eliminar si `PENDING` |
| `GET` | `/user/timeline-entry-content-suggestions/` | Autenticado | Mis sugerencias (`?status=`, `?topic_id=`) |

### Ejemplo — crear

```http
POST /api/content/topics/42/timeline/15/content-suggestions/create/
Content-Type: application/json

{
  "content_id": 101,
  "message": "Este PDF complementa el whitepaper en esta fecha."
}
```

**Respuesta 201** (campos relevantes):

```json
{
  "id": 7,
  "entry": { "id": 15, "title": "Whitepaper Lanzamiento", "start_date": "2008-10-31" },
  "content": { "id": 101, "original_title": "bitcoin.pdf", "media_type": "TEXT" },
  "status": "PENDING",
  "is_duplicate": false,
  "is_in_topic": true,
  "message": "Este PDF complementa el whitepaper en esta fecha."
}
```

### Lógica de aceptación

Implementada en `accept_timeline_entry_content_suggestion()` (`acbc_app/content/utils.py`).

---

## Frontend

### Flujo del sugeridor

1. Pestaña **Línea de tiempo** del tema (`TopicDetail`).
2. Expandir una entrada (flecha de detalles).
3. Ícono de bombilla con tooltip *"Sugerir contenido para esta entrada"* (solo visible expandido).
4. Página `/content/topics/:topicId/timeline/:entryId/suggest-content`.
5. Formulario: contexto de la entrada (solo lectura) + `ContentSuggestionPicker` (1 contenido) + mensaje para moderadores.
6. Tras enviar → vuelta a la línea de tiempo.

### Moderación

- **Editar tema → Sugerencias** → bloque **"Contenido sugerido para entradas"** (`TimelineEntryContentSuggestionsManager`).
- El badge de pendientes en **Editar tema** suma también estas sugerencias.

### Componentes

| Archivo | Rol |
|---------|-----|
| `TopicTimelineEntryCard.jsx` | Ícono de sugerencia al expandir |
| `TopicTimelineEntryContentSuggestionPage.jsx` | Página del formulario |
| `TopicTimelineEntryContentSuggestionForm.jsx` | Formulario |
| `TimelineEntryContentSuggestionsManager.jsx` | Tabla de moderación |
| `ContentSuggestionPicker.jsx` | Selector biblioteca / URL / archivo |

### Rutas (`App.jsx`)

```
/content/topics/:topicId/timeline/:entryId/suggest-content
```

### API cliente (`contentApi.js`)

- `createTopicTimelineEntryContentSuggestion(topicId, entryId, payload)`
- `getTopicTimelineEntryContentSuggestions(topicId, filters)`
- `acceptTopicTimelineEntryContentSuggestion(topicId, suggestionId)`
- `rejectTopicTimelineEntryContentSuggestion(topicId, suggestionId, reason)`
- `deleteTopicTimelineEntryContentSuggestion(topicId, suggestionId)`
- `getUserTimelineEntryContentSuggestions(filters)`

---

## Notificaciones

En `acbc_app/utils/notification_utils.py`:

| Función | Destinatario | Momento |
|---------|--------------|---------|
| `notify_timeline_entry_content_suggestion_created` | Moderadores + creador | Al crear |
| `notify_timeline_entry_content_suggestion_accepted` | Sugeridor | Al aceptar |
| `notify_timeline_entry_content_suggestion_rejected` | Sugeridor | Al rechazar |

---

## Tests

Clase: `TopicTimelineEntryContentSuggestionsAPITests` en `acbc_app/content/tests.py`.

```bash
docker compose exec backend python manage.py test content.tests.TopicTimelineEntryContentSuggestionsAPITests -v 1
```

Cubre:

- Crear con contenido de biblioteca o del tema
- Rechazo de contenido ajeno (ni tema ni biblioteca)
- Reutilización del mismo contenido en **otra** entrada
- `is_duplicate` cuando ya está en la **misma** entrada
- Pendiente duplicada del mismo usuario
- Listar y filtrar por `entry_id`
- Aceptar (añade al tema, crea vínculo, cierra `ContentSuggestion` pendiente)
- Aceptar sin duplicar vínculo existente
- Rechazar con/sin razón
- Eliminar (permisos)
- Listado del usuario
- Entrada de otro tema → 404

---

## Referencias

- Entradas nuevas: [topic-timeline-entry-suggestions-plan.md](topic-timeline-entry-suggestions-plan.md)
- Línea de tiempo general: [topics-and-knowledge-paths.md](topics-and-knowledge-paths.md)
- API: [../api/endpoints.md](../api/endpoints.md)
- Permisos: [../security/endpoint-permissions-map.md](../security/endpoint-permissions-map.md)
