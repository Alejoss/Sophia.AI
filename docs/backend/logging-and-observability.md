# Logging, middleware, and observability

## Logging

- **Configuration**: `LOGGING` in `settings.py` differs by `ENVIRONMENT`. Production: `RotatingFileHandler` (10MB, 5 backups), `error_file` for `ERROR`; dev: console + file, `DEBUG` levels.
- **Paths**: File logs go to `LOGS_DIR` (default `logs/` next to the Django project, `/app/logs` in Docker). Set `LOGS_DIR` to override. Production does not fall back to `/tmp`: that directory is deleted when the container is recreated.
- **Gunicorn**: `entrypoint.sh` still starts Gunicorn with `--bind 0.0.0.0:8000 --workers 3 --timeout 600 --access-logfile - --error-logfile -`. `gunicorn.conf.py` only adds file handlers. It must not set bind, workers, timeout, or the stdout/stderr destinations. The master writes `gunicorn-master.log` before fork. Each worker closes that inherited file and writes `gunicorn-access.log` and `gunicorn-error.log` after Django loads.
- **Security**:
  - **Do not** log request bodies, `Authorization` headers, cookies, or tokens. `RequestLoggingMiddleware` → `log_request` logs only `method`, `path`, `user_id`, `username`, `ip_address`, `user_agent`, `query_params`, `status_code`, `response_size`, `duration`.
  - Avoid logging PII (e.g. emails, passwords) in `extra`. Use IDs/usernames only where needed for debugging.
  - If you add body/header logging later, redact secrets first.

## Where to read logs

`docker compose logs` shows only the container that is running now. Recreate (`deploy.sh` uses `up --force-recreate`) deletes that stream. Older lines are the files below. `docker compose down -v` deletes the volumes.

Production compose file: `docker-compose.prod.yml`. Prefix commands with `docker compose --env-file .env.compose -f docker-compose.prod.yml`.

| What you need | File inside the container | Volume |
|---|---|---|
| Django application log | `/app/logs/academia_blockchain.log` | `acbc_prod_backend_logs` |
| Django errors | `/app/logs/errors.log` | `acbc_prod_backend_logs` |
| Gunicorn worker errors | `/app/logs/gunicorn-error.log` | `acbc_prod_backend_logs` |
| Gunicorn access | `/app/logs/gunicorn-access.log` | `acbc_prod_backend_logs` |
| Gunicorn master (boot, worker timeouts) | `/app/logs/gunicorn-master.log` | `acbc_prod_backend_logs` |
| Edge nginx access and errors | `/var/log/nginx/persisted/access.log`, `error.log` | `acbc_prod_nginx_logs` |
| Frontend nginx access and errors | `/var/log/nginx/persisted/access.log`, `error.log` | `acbc_prod_frontend_logs` |
| Postgres (current container only) | `docker compose logs postgres` | none. Do not replace the image entrypoint. |

```bash
docker compose --env-file .env.compose -f docker-compose.prod.yml exec backend tail -n 200 /app/logs/errors.log
docker compose --env-file .env.compose -f docker-compose.prod.yml exec backend tail -n 200 /app/logs/gunicorn-master.log
docker compose --env-file .env.compose -f docker-compose.prod.yml exec nginx tail -n 200 /var/log/nginx/persisted/error.log
docker compose --env-file .env.compose -f docker-compose.prod.yml exec frontend tail -n 200 /var/log/nginx/persisted/access.log
docker compose --env-file .env.compose -f docker-compose.prod.yml logs --tail=200 postgres
```

Dev compose (`docker-compose.yml`) uses the same app and nginx paths and the volumes `acbc_dev_backend_logs` and `acbc_dev_frontend_logs`. There is no edge nginx container. The backend volume hides `acbc_app/logs` on the host, so a `docker compose exec` is the read path. A process started without Docker writes `acbc_app/logs/` directly.

Nginx files grow until rotation. Copy `scripts/docker/acbc-logrotate.conf` to `/etc/logrotate.d/acbc` on the droplet. Django and Gunicorn rotate their own files (10MB, several backups). Do not point logrotate at `academia_blockchain.log`, `errors.log`, or the `gunicorn-*.log` files; those handlers rename the files themselves.

Postgres keeps the official image entrypoint. Its log stream is deleted on recreate. A shell wrapper that copied stderr onto a volume made `acbc_postgres_prod` fail its healthcheck and took the site down with Cloudflare 521. Recovery steps: [postgres-container-unhealthy.md](../operations/postgres-container-unhealthy.md).

## RequestLoggingMiddleware

- Skips `/health/`, `/static/`, `/media/`, `/favicon.ico`.
- Logs other requests via `log_request`; on exception, logs then re-raises.

## Health checks

- **`GET /health/`**: Django view, returns `{"status":"healthy","service":"academia_blockchain"}`. No DB or external calls — use for **liveness**.
- **Readiness**: If you need a readiness check (e.g. DB connectivity), add a separate endpoint (e.g. `GET /health/ready/`) that runs a lightweight DB query and returns 200/503. Keep `/health/` free of dependencies.

## Sentry

- **Status**: Sentry is wired. Backend: `sentry_config.configure_sentry()` is called at the end of `settings.py` when `SENTRY_DSN` is set; `SentryUserMiddleware` adds user context. Frontend: `@sentry/react` in `main.jsx` when `VITE_SENTRY_DSN` is set **and** Vite MODE is not a local/test mode, with `ErrorBoundary` and optional Replay.
- **Backend**: Set `SENTRY_DSN` in `acbc_app/.env`. Optional: `SENTRY_TRACES_SAMPLE_RATE` (default 0.1), `SENTRY_PROFILES_SAMPLE_RATE` (default 0.0). Init is skipped when `ENVIRONMENT` is `development` / `dev` / `local` / `test` / `testing`.
- **Frontend**: Set `VITE_SENTRY_DSN` in the production/beta build env (not for `npm run dev`). Init is skipped for the same local/test MODE values as the backend; `beforeSend` also drops events from `localhost` / loopback. Rebuild after changing.
- **PII**: `send_default_pii=True` in backend; Replay on frontend uses `maskAllText: true`, `blockAllMedia: true`.
- **Policy**: See [sentry-and-logging-policy.md](./sentry-and-logging-policy.md) for log levels vs 4xx/5xx and the manual verification checklist.

## Recommendations

1. Keep request logging free of bodies, auth headers, and cookies.
2. Use `/health/` for liveness; add `/health/ready/` if you need readiness (e.g. DB).
3. Integrate Sentry in production with DSN and sampling; document in deployment runbooks.
