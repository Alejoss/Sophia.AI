# CI/CD flow

## Overview

- **Tests**: On every push to `main` and on PRs. PostgreSQL service, Django tests, coverage, `manage.py check --deploy`.
- **Deploy**: Only on push to `main`, after tests pass. SSH to server, pull, build, up, migrate, collectstatic, health checks.

## GitHub Actions ([.github/workflows/deploy.yml](../../.github/workflows/deploy.yml))

### Test job

- Python **3.12** (matches backend Dockerfile).
- PostgreSQL 15 service; Django uses `DB_HOST=localhost`, `DB_NAME`, `POSTGRES_*`.
- `pip install -r acbc_app/requirements.txt`; `manage.py migrate`; `manage.py test`; `coverage`; `manage.py check --deploy`.
- Runs from repo root; Django via `acbc_app/`.

### Deploy job

- **Secrets**: `HOST`, `USERNAME`, `SSH_PRIVATE_KEY`, `PORT` (optional). Optionally `DEPLOY_PATH` (default `~/Sophia.AI`).
- **Steps** (on server):
  1. `cd $DEPLOY_PATH` (or `~/Sophia.AI`).
  2. `git pull`.
  3. `docker compose -f docker-compose.prod.yml build --no-cache` and `up -d --force-recreate`.
  4. `docker compose -f docker-compose.prod.yml exec backend python manage.py migrate --noinput`.
  5. `docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput`.
  6. Health check: `curl -sf http://localhost/health/` (backend). Optional: `curl http://localhost/health`.
  7. If host nginx is present: `nginx -t` and `nginx -s reload`.

Secrets are not printed in logs.

## Scripts

- **deploy.sh**: Uses `docker-compose -f docker-compose.prod.yml`, validations, migrate, collectstatic, health checks. For manual production deploys.
- **backup-db.sh** / **restore-db.sh**: Use same project root and `docker-compose.prod.yml`; same `DB_NAME`/`DB_USER` as production.

## Deployment path

- CI deploy uses `secrets.DEPLOY_PATH` if set, otherwise `~/Sophia.AI`. Document your actual path (e.g. `/opt/acbc-app` or `~/Sophia.AI`) and set `DEPLOY_PATH` in GitHub secrets if it differs.
