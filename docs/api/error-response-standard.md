# API error response standard

## Overview

- Use consistent HTTP status codes and JSON shape for API errors.
- **Never** return `str(exception)` or stack traces in responses (log them server-side only).

## Recommended shape

```json
{
  "error": "Human-readable message (generic for 5xx)"
}
```

Optional `details` only for **validation** (4xx) when useful to the client, e.g. serializer errors.

## By status

| Status | Use | `error` content |
|--------|-----|------------------|
| 400 | Validation (serializer invalid) | DRF default or custom message; avoid leaking internals. |
| 401 | Unauthenticated | e.g. `"Authentication credentials were not provided."` |
| 403 | Forbidden | e.g. `"You do not have permission to perform this action."` |
| 404 | Not found | e.g. `"X not found."` (no internal IDs or paths). |
| 429 | Rate limited | e.g. `"Too many requests. Try again later."` |
| 500 | Server error | **Generic only**: e.g. `"An unexpected error occurred."` |

## Implementation

- Log full exception with `logger.error(..., exc_info=True)`.
- Return generic `error` for 500; do **not** expose `str(e)` or tracebacks.
- `publications.views.PublicationDetailView` follows this; other views should be migrated.

## Rate limiting

- **Login**: Per-IP limit (e.g. 20 failed attempts) via custom logic in `profiles.views`; 429 when exceeded.
- **Registration, password reset, search**: Consider per-IP or per-user limits (e.g. `django-ratelimit` or API gateway).
- See [api-security.md](../security/api-security.md) for further notes.

## Related

- [API Security](../security/api-security.md)
- [Settings checklist](../security/settings-checklist.md)
