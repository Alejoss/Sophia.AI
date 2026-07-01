# Plan: Sugerir entrada en la línea de tiempo

Documento de diseño para la funcionalidad **"Sugerir entrada en la línea de tiempo"**, modelada sobre el flujo existente de **Sugerir contenido** en temas.

Estado: **implementado** (sugerencias de timeline, hub de edición unificado y sugerencias de vínculo contenido ↔ entrada).

Ver también: [Sugerir contenido para una entrada](topic-timeline-entry-content-suggestions.md).

---

## Referencia: "Sugerir contenido" hoy

### Flujo

1. Usuario autenticado **no moderador** abre `ContentSuggestionModal` desde `TopicDetail`.
2. Elige contenido (biblioteca, URL o archivo) y opcionalmente un mensaje.
3. `POST /content/topics/<pk>/content-suggestions/create/` crea `ContentSuggestion` en estado `PENDING`.
4. Se notifica a moderadores del tema.
5. Creador/moderador revisa en `ContentSuggestionsManager` (`TopicEdit`) o vía badge en `TopicDetail`.
6. **Aceptar** → `topic.contents.add(content)` si no es duplicado.
7. **Rechazar** → `rejection_reason` obligatorio + notificación al sugeridor.

### Modelo `ContentSuggestion`

| Campo | Rol |
|-------|-----|
| `topic`, `content`, `suggested_by` | Qué se sugiere y quién |
| `status` | `PENDING` → `ACCEPTED` / `REJECTED` |
| `message` | Justificación opcional del sugeridor |
| `rejection_reason` | Obligatorio al rechazar |
| `is_duplicate` | Si el contenido ya está en el tema |
| `reviewed_by`, `reviewed_at` | Auditoría |

Invariante: `unique_together = [topic, content, suggested_by]`.

### API

| Endpoint | Quién |
|----------|-------|
| `POST .../content-suggestions/create/` | Cualquier autenticado |
| `GET .../content-suggestions/` | Cualquier autenticado |
| `POST .../accept/` | Creador o moderador |
| `POST .../reject/` | Creador o moderador |
| `DELETE .../content-suggestions/:id/` | Solo el sugeridor (pendientes) |
| `GET /user/content-suggestions/` | Mis sugerencias |

### UI

| Componente | Rol |
|------------|-----|
| `TopicDetail` | Botón **Sugerir Contenido** (no moderador/creador) |
| `ContentSuggestionModal` | Wizard biblioteca → mensaje → enviar |
| `ContentSuggestionsManager` | Pestaña **Sugerencias** en `TopicEdit` |
| `TopicContentSuggestionsPage` | Lista pública |
| `TopicsUser` | Tab "Mis sugerencias" |

### Patrón reutilizable

1. Entidad de sugerencia con estado y auditoría.
2. Crear abierto; revisar restringido a `topic.is_moderator_or_creator`.
3. Aceptar ejecuta la acción real (side effect).
4. Rechazar exige motivo.
5. Notificaciones en cada transición.
6. Badge de pendientes para moderadores.

### Lección de UX (timeline)

Los formularios de línea de tiempo usan **páginas dedicadas** (`TopicTimelineEntryPage`), no modales, para evitar conflictos con overlays (p. ej. `CommunityBubble`). Las sugerencias de entrada deben seguir el mismo criterio.

---

## Objetivo

Permitir que usuarios autenticados (no creadores/moderadores) propongan **entradas narrativas** para la línea de tiempo de un tema, con revisión curatorial antes de publicarlas.

---

## Decisiones de diseño

### Alcance por fases

| Fase | Campos | Contenidos vinculados |
|------|--------|------------------------|
| **MVP** | título, descripción, fechas, mensaje | Ninguno |
| **V2** | + contenidos | Solo contenidos **ya en el tema** |
| **V3** (opcional) | + contenidos externos | Biblioteca del sugeridor; al aceptar se añaden al tema y a la entrada |

Recomendación: **MVP** primero; **V2** en cuanto el formulario de entrada requiera contenidos del tema.

### Al aceptar

1. Crear `TopicTimeline` si no existe.
2. Crear `TopicTimelineEntry` con los datos propuestos.
3. Crear `TopicTimelineEntryContent` por cada contenido vinculado (V2+).
4. Asignar `order` al final (misma lógica que `TopicTimelineEntrySerializer.create`).
5. Opcional: pantalla de revisión para que el moderador edite antes de publicar.

### Duplicados

- `is_duplicate`: entrada con mismo título y fechas ya publicada.
- Considerar `unique_together = [topic, suggested_by, title]` para limitar spam.

### Permisos

| Acción | Permiso |
|--------|---------|
| Sugerir | Autenticado, no moderador/creador |
| Ver sugerencias del tema | Autenticado |
| Aceptar / rechazar | Creador o moderador |
| Eliminar | Solo el sugeridor (si `PENDING`) |

---

## Modelo propuesto

### `TopicTimelineEntrySuggestion`

```python
class TopicTimelineEntrySuggestion(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE)
    suggested_by = models.ForeignKey(User, on_delete=models.CASCADE)
    reviewed_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    proposed_order = models.PositiveIntegerField(null=True, blank=True)

    message = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    status = models.CharField(choices=PENDING|ACCEPTED|REJECTED, default=PENDING)
    is_duplicate = models.BooleanField(default=False)

    accepted_entry = models.ForeignKey(
        TopicTimelineEntry, null=True, blank=True, on_delete=models.SET_NULL
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
```

### `TopicTimelineEntrySuggestionContent` (V2)

```python
class TopicTimelineEntrySuggestionContent(models.Model):
    suggestion = models.ForeignKey(TopicTimelineEntrySuggestion, related_name='suggested_contents')
    content = models.ForeignKey(Content, on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    caption = models.CharField(max_length=255, blank=True)
```

Validación al crear: contenidos deben pertenecer al tema (V2) o existir como `ContentSuggestion` pendiente del mismo usuario (V3).

---

## API propuesta

Prefijo: `/content/topics/<pk>/timeline-suggestions/`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/create/` | Crear sugerencia |
| `GET` | `/` | Listar (`status`, `suggested_by`) |
| `POST` | `/<id>/accept/` | Aceptar → crea entrada |
| `POST` | `/<id>/reject/` | Rechazar (razón obligatoria) |
| `DELETE` | `/<id>/` | Eliminar (sugeridor, solo `PENDING`) |
| `GET` | `/user/timeline-entry-suggestions/` | Mis sugerencias |

Reutilizar validaciones de `TopicTimelineEntrySerializer` donde sea posible.

---

## Frontend propuesto

### Rutas (páginas, no modales)

| Ruta | Componente |
|------|------------|
| `/content/topics/:id/timeline/suggest` | `TopicTimelineEntrySuggestionPage` |
| `/content/topics/:id/timeline/suggestions` | Lista pública |

### Integración en `TopicDetail` (pestaña Línea de tiempo)

- Usuario normal: **Sugerir entrada en la línea de tiempo**
- Moderador: badge **Gestionar sugerencias de línea de tiempo**

### Moderación

- `TimelineEntrySuggestionsManager` en `TopicEdit` (espejo de `ContentSuggestionsManager`)
- Tab o sección en `TopicsUser`: "Mis sugerencias de línea de tiempo"

### Componentes reutilizables

- `TopicTimelineDateFields`
- `TopicTimelineContentSelector` (contenidos del tema vía `getTopicDetails`, no `content-simple`)
- Formulario adaptado de `TopicTimelineEntryForm` + campo mensaje

---

## Notificaciones

En `notification_utils.py`:

- `notify_timeline_entry_suggestion_created` → moderadores
- `notify_timeline_entry_suggestion_accepted` → sugeridor
- `notify_timeline_entry_suggestion_rejected` → sugeridor

Verbo sugerido: *"sugirió una entrada en la línea de tiempo para"*.

---

## Plan de implementación

### Fase 1 — Backend MVP (2–3 días)

- [ ] Modelo `TopicTimelineEntrySuggestion` + migración
- [ ] Serializer con validación de fechas
- [ ] Views: create, list, accept, reject, delete
- [ ] Tests (permisos, accept crea entrada, reject exige razón)
- [ ] Notificaciones básicas

### Fase 2 — Frontend sugeridor (1–2 días)

- [ ] Página `.../timeline/suggest`
- [ ] Botón en `TopicDetail` / pestaña timeline
- [ ] Métodos en `contentApi.js`
- [ ] "Mis sugerencias" en `TopicsUser`

### Fase 3 — Moderación (1–2 días)

- [ ] `TimelineEntrySuggestionsManager` en `TopicEdit`
- [ ] Badge de pendientes en `TopicDetail`
- [ ] Página pública de sugerencias del tema
- [ ] Preview al aceptar

### Fase 4 — Contenidos vinculados (1–2 días)

- [ ] `TopicTimelineEntrySuggestionContent`
- [ ] Selector en formulario de sugerencia
- [ ] Al aceptar: crear vínculos en la entrada

### Fase 5 — Pulido (1 día)

- [ ] Documentación en `topics-and-knowledge-paths.md`
- [ ] `endpoint-permissions-map.md`
- [ ] Detección de duplicados
- [ ] Opcional: votos (como `ContentSuggestion`)

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Orden al aceptar | Siempre al final en MVP; `proposed_order` informativo en V2 |
| Contenido no en el tema | V2: validar; V3: cascada con sugerencia de contenido |
| UX del formulario | Solo páginas, nunca modales |
| Spam | `unique_together` + rate limit opcional |
| Línea de tiempo oculta | Al aceptar primera entrada, la pestaña se hace visible |

---

## Criterios de aceptación (MVP)

1. Usuario no moderador puede proponer entrada (título, descripción, fechas).
2. Moderadores ven pendientes y reciben notificación.
3. Aceptar crea una entrada real en la línea de tiempo.
4. Rechazar requiere motivo y notifica al sugeridor.
5. El sugeridor puede eliminar su sugerencia pendiente.
6. Todo el flujo usa páginas dedicadas, no modales.

---

## Referencias en el código

- Modelo sugerencia contenido: `acbc_app/content/models.py` → `ContentSuggestion`
- Views: `TopicContentSuggestionCreateView`, `TopicContentSuggestionAcceptView`, etc.
- Frontend: `frontend/src/topics/ContentSuggestionModal.jsx`, `ContentSuggestionsManager.jsx`
- Línea de tiempo: `docs/architecture/topics-and-knowledge-paths.md` (sección Líneas de tiempo)
