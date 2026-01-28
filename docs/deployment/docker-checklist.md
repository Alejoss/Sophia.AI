# Docker and backend deployment checklist

## Image

- [ ] Base image: `python:3.12-slim-bookworm`; no debug tools in production.
- [ ] `requirements.txt`: UTF-8, no BOM; `pip install -r requirements.txt` works in CI and Docker.
- [ ] Project files copied into image; `logs` directory created.

## Entrypoint

- [ ] `entrypoint.sh`: `ENVIRONMENT=PRODUCTION` → Gunicorn; otherwise → `runserver`.
- [ ] Production never uses `runserver`; Gunicorn workers and timeout configured.

## Environment variables

Backend uses `acbc_app/.env`. Align with [.env.example](../../acbc_app/.env.example) and [environment-variables](environment-variables.md).

**Django (production):**

- `ENVIRONMENT=PRODUCTION`
- `DEBUG=False`
- `ACADEMIA_BLOCKCHAIN_SKEY` (non-default)
- `ALLOWED_HOSTS` (comma-separated)
- `DB_NAME`, `DB_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (and optionally `DB_PORT`)

**Docker Compose:**

- Postgres: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (compose env).
- Backend: same vars via `env_file` + overrides; `DB_HOST=postgres` (service name) when using compose.

Ensure `DB_NAME` / `POSTGRES_DB` and user/password are consistent between Postgres container and Django.

## Volumes

- **Development** (`docker-compose.yml`): code mount, `static_volume`, `media_volume`.
- **Production** (`docker-compose.prod.yml`): no code mount; only `static_volume` and `media_volume`.
- [ ] Production does not mount sensitive or host paths that overwrite app code.

## Optional

- [ ] `.dockerignore` in `acbc_app` to exclude `__pycache__`, `.env`, `*.pyc`, tests, etc., if not already present.
