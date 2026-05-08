# Sentry and logging policy (backend views)

This document defines **severity levels** and **Sentry expectations** for Django/DRF views so we capture real failures (integrations, 5xx) while avoiding noise from expected client errors (4xx).

See also: [logging-and-observability.md](./logging-and-observability.md), `acbc_app/academia_blockchain/sentry_config.py`, `acbc_app/utils/logging_utils.py`.

## How Sentry is fed today

- `LoggingIntegration(event_level=logging.ERROR)` sends **log records at ERROR or above** as Sentry events.
- **WARNING / INFO** do not create issues (they can still appear as breadcrumbs).
- Uncaught exceptions may also be reported via `DjangoIntegration`, depending on configuration.

## Severity matrix

| Situation | Log level | HTTP | Sentry issue? |
|-----------|-----------|------|----------------|
| Invalid input / serializer / form validation | `WARNING` or `INFO` | 400 | No |
| Auth missing or invalid token (expected) | `WARNING` | 401 / 403 | No |
| Permission denied (business rule) | `WARNING` | 403 | No |
| Not found (expected business 404) | `WARNING` or `INFO` | 404 | No |
| Optional enrichment failed (e.g. favicon, URL preview) | `DEBUG` or `WARNING` | 200 / partial | No |
| **Dependency failure** (Postmark, S3, Google certs unreachable, etc.) | `ERROR` | 5xx / 503 | **Yes** |
| **Unexpected server error** | `ERROR` + `exc_info=True` | 500 | **Yes** |
| Notification/email send failed after primary action succeeded | `ERROR` + `exc_info=True` | 200 | **Yes** (integration) |

## Rules for `except` blocks

1. **Never swallow** unexpected exceptions: at minimum log with context (`user_id`, resource ids, endpoint/action).
2. **Expected 4xx**: log at `WARNING`, return the correct status; do **not** use `logger.error` unless it indicates a server or integration problem.
3. **Unexpected errors**: use `logger.error(..., exc_info=True)` or `utils.logging_utils.log_error(...)` and return **500** (not 400) when the failure is not the client’s fault.
4. **Avoid duplicate ERROR logs** for the same failure in nested layers unless each layer adds distinct context.

## Helper

- `utils.logging_utils.log_error(exception, context=..., user_id=..., extra=..., logger_instance=...)` — central ERROR + `exc_info` for Sentry; pass `logger_instance` to keep the Django logger name (e.g. `content`).

## Sentry `before_send` (defensive)

`configure_sentry()` registers a `before_send` hook that drops events tied to **known expected exception types** (e.g. DRF `AuthenticationFailed`, JWT `TokenError`, Django `ValidationError` on input) so escaped `ERROR` logs are less likely to open issues.

**Do not** rely only on `before_send`: fix the source log level first.

## Manual verification checklist

Run in an environment with `SENTRY_DSN` set (e.g. staging) and confirm:

1. **401 / 403 expected** (bad refresh token, missing cookie): no new Sentry issue; logs at WARNING if applicable.
2. **400 validation** (bad body, missing fields): no Sentry issue.
3. **Simulated Postmark / email failure** (or other mail integration error): **issue appears** in Sentry.
4. **Forced uncaught or logged ERROR** in a view (e.g. test endpoint): **issue appears**.
5. **Google OAuth**: failure to fetch **signing keys** (503 path) still produces **ERROR** / Sentry; invalid client token messages stay **WARNING** / no issue.

Record results in your deployment or release notes when changing auth or logging.
