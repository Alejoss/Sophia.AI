# Logging, middleware, and observability

## Logging

- **Configuration**: `LOGGING` in `settings.py` differs by `ENVIRONMENT`. Production: `RotatingFileHandler` (10MB, 5 backups), `error_file` for `ERROR`; dev: console + file, `DEBUG` levels.
- **Paths**: Logs under `LOGS_DIR` (`logs/` or `/tmp/...` fallback). Rotate by size; avoid unbounded growth.
- **Security**:
  - **Do not** log request bodies, `Authorization` headers, cookies, or tokens. `RequestLoggingMiddleware` → `log_request` logs only `method`, `path`, `user_id`, `username`, `ip_address`, `user_agent`, `query_params`, `status_code`, `response_size`, `duration`.
  - Avoid logging PII (e.g. emails, passwords) in `extra`. Use IDs/usernames only where needed for debugging.
  - If you add body/header logging later, redact secrets first.

## RequestLoggingMiddleware

- Skips `/health/`, `/static/`, `/media/`, `/favicon.ico`.
- Logs other requests via `log_request`; on exception, logs then re-raises.

## Health checks

- **`GET /health/`**: Django view, returns `{"status":"healthy","service":"academia_blockchain"}`. No DB or external calls — use for **liveness**.
- **Readiness**: If you need a readiness check (e.g. DB connectivity), add a separate endpoint (e.g. `GET /health/ready/`) that runs a lightweight DB query and returns 200/503. Keep `/health/` free of dependencies.

## Sentry

- **Status**: `sentry_config.py` is prepared but not wired. Sentry is not configured in `settings.py` or `LOGGING`.
- **When to use**: Production error tracking and performance monitoring.
- **Setup**: Set `SENTRY_DSN`; call `configure_sentry()` from `settings.py`; optionally add Sentry handler to `LOGGING` for `django` / `django.request`. Use `ENVIRONMENT` and `traces_sample_rate` (e.g. &lt; 1.0) to control volume.
- **PII**: Use `send_default_pii` only if required; prefer keeping PII out of Sentry events.

## Recommendations

1. Keep request logging free of bodies, auth headers, and cookies.
2. Use `/health/` for liveness; add `/health/ready/` if you need readiness (e.g. DB).
3. Integrate Sentry in production with DSN and sampling; document in deployment runbooks.
