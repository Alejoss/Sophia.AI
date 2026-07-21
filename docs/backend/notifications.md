# Notifications

In-app notifications use [django-notifications-hq](https://github.com/django-notifications/django-notifications) for storage. Creation logic lives in `acbc_app/utils/notification_utils.py`. The SPA reads and updates notifications through **custom endpoints under** `/api/profiles/notifications/` (not the stock `django-notifications` REST routes).

## API (profiles)

All endpoints require authentication (`IsAuthenticated`).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/profiles/notifications/` | List notifications for the current user. By default returns **unread only**. Pass `?show_all=true` to include read notifications. Triggers automatic cleanup of read notifications older than 30 days. |
| GET | `/api/profiles/notifications/unread-count/` | Lightweight unread count (`{ "unread_count": N }`). |
| POST | `/api/profiles/notifications/{id}/mark-as-read/` | Mark one notification as read. |
| POST | `/api/profiles/notifications/mark-all-as-read/` | Mark all unread notifications as read. |

### Response shape (list)

```json
{
  "notifications": [
    {
      "id": 1,
      "actor": "alice",
      "actor_id": 2,
      "verb": "comentó en tu camino de conocimiento",
      "description": "alice comentó en tu camino de conocimiento \"Intro\"...",
      "timestamp": "2026-07-02T12:00:00Z",
      "unread": true,
      "content_type": "comment",
      "target_url": "/knowledge_path/5",
      "context_title": "Intro",
      "target": { "id": 5, "title": "Intro" }
    }
  ],
  "cleaned_up_count": 0
}
```

`target_url` and `context_title` are computed in `NotificationSerializer` (`profiles/serializers.py`). Verb matching is ASCII-normalized so links still resolve when PostgreSQL `SQL_ASCII` has stored verbs without accents.

## Frontend

- API client: `frontend/src/api/profilesApi.js`
- UI: `frontend/src/profiles/Notifications.jsx` (profile section `?section=notifications`)
- Read notifications are shown with a note that they are removed after 30 days (cleanup runs on list fetch).

## Notification types

| Verb | Recipient | Trigger |
|------|-----------|---------|
| `respondió a` | Parent comment author | Comment reply |
| `comentó en tu camino de conocimiento` | Knowledge path author | Top-level KP comment |
| `comentó en tu contenido` | Content profile owner | Top-level content comment |
| `completó tu camino de conocimiento` | Knowledge path author | Path completed |
| `solicitó un certificado para tu camino de conocimiento` | Knowledge path author | Certificate request |
| `aprobó tu solicitud de certificado para` | Student | Certificate approved |
| `rechazó tu solicitud de certificado para` | Student | Certificate rejected |
| `votó positivamente tu contenido` | Content uploader | Upvote on content |
| `votó positivamente tu camino de conocimiento` | Knowledge path author | Upvote on KP |
| `se registró en tu evento` | Event owner | Event registration |
| `aceptó tu pago para` | Student | Payment accepted |
| `te envió un certificado para` | Student | Event certificate sent |
| `te invitó a moderar` | Invited user | Moderator invitation |
| `aceptó tu invitación para moderar` | Topic creator | Invitation accepted |
| `rechazó tu invitación para moderar` | Topic creator | Invitation declined |
| `te removió como moderador de` | Removed moderator | Moderator removed |
| `sugirió contenido para` | Topic moderators + creator | Content suggestion created |
| `aceptó tu sugerencia de contenido para` | Suggester | Content suggestion accepted |
| `rechazó tu sugerencia de contenido para` | Suggester | Content suggestion rejected |
| `sugirió una entrada en la línea de tiempo para` | Topic moderators + creator | Timeline entry suggestion |
| `aceptó tu sugerencia de entrada en la línea de tiempo para` | Suggester | Timeline entry accepted |
| `rechazó tu sugerencia de entrada en la línea de tiempo para` | Suggester | Timeline entry rejected |
| `sugirió vincular contenido a una entrada de la línea de tiempo en` | Topic moderators + creator | Timeline content link suggestion |
| `aceptó tu sugerencia de vincular contenido a una entrada en` | Suggester | Timeline content link accepted |
| `rechazó tu sugerencia de vincular contenido a una entrada en` | Suggester | Timeline content link rejected |
| `sugirió un archivo para tu contenido` | Content owner | File suggestion for URL content |

## Policies

### Deduplication

Most helpers in `notification_utils.py` skip creation when an identical notification already exists (same `recipient`, `actor`, `verb`, `action_object`, `target`). Some high-frequency flows also throttle by time window (e.g. certificate requests within the last hour).

### Performance

The unread-count endpoint is optimized for frequent polling from the header badge:

- **DB index**: composite index on `(recipient_id, unread)` on `notifications_notification` (migration `profiles.0004_notification_unread_index`).
- **Server cache**: in-process cache (30s TTL) per user via `utils/notification_cache.py`. Invalidated on notification create/update/delete and when marking as read.
- **Client**: `NotificationsContext` polls every 60s, refreshes when the tab becomes visible, and throttles manual refreshes to at most once every 15s. Header and profile sidebar share the same context (one request, not two).


High-traffic features (comments, votes, suggestions) can create many rows. Monitor DB growth; consider caps or batching if needed.

## Related docs

- [Models and data policies](models-and-notifications.md) — indexes, N+1, fixtures
- [API endpoints](../api/endpoints.md#notifications)
- [Timeline entry suggestions](../architecture/topic-timeline-entry-suggestions-plan.md)
- [Timeline content link suggestions](../architecture/topic-timeline-entry-content-suggestions.md)
