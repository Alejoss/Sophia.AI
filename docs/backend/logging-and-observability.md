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

- **Status**: Sentry is wired. Backend: `sentry_config.configure_sentry()` is called at the end of `settings.py` when `SENTRY_DSN` is set; `SentryUserMiddleware` adds user context. Frontend: `@sentry/react` in `main.jsx` when `VITE_SENTRY_DSN` is set, with `ErrorBoundary` and optional Replay.
- **Backend**: Set `SENTRY_DSN` in `acbc_app/.env`. Optional: `SENTRY_TRACES_SAMPLE_RATE` (default 0.1), `SENTRY_PROFILES_SAMPLE_RATE` (default 0.0).
- **Frontend**: Set `VITE_SENTRY_DSN` in `frontend/.env` for beta/production. Rebuild after changing.
- **PII**: `send_default_pii=True` in backend; Replay on frontend uses `maskAllText: true`, `blockAllMedia: true`.

## Recommendations

1. Keep request logging free of bodies, auth headers, and cookies.
2. Use `/health/` for liveness; add `/health/ready/` if you need readiness (e.g. DB).
3. Integrate Sentry in production with DSN and sampling; document in deployment runbooks.
