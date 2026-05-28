# CI/CD flow

## Overview

- **Tests**: On every push to `main` and on PRs. PostgreSQL service, Django tests, coverage, `manage.py check --deploy`.
- **Frontend check**: On every push to `main` and on PRs. `npm ci` (validates `package.json` vs `package-lock.json`) and `npm run build` in `frontend/`.
- **Images**: Only on push to `main` or manual dispatch, after tests and frontend check pass. Build backend/frontend/nginx images and publish them to GHCR.
- **Deploy**: Server deploys pull prebuilt GHCR images, run `up`, migrate, collectstatic, health checks.

## GitHub Actions ([.github/workflows/deploy.yml](../../.github/workflows/deploy.yml))

### Frontend check job

- Node **18**.
- `cd frontend && npm ci` — fails if `package-lock.json` is out of sync with `package.json`.
- `npm run build` with `VITE_API_URL` and `VITE_GOOGLE_OAUTH_CLIENT_ID` from GitHub Repository variables, or CI fallbacks if unset.
- Runs on PRs and on `main`; blocks image publish when it fails.

### Test job

- Python **3.12** (matches backend Dockerfile).
- PostgreSQL 15 service; Django uses `DB_HOST=localhost`, `DB_NAME`, `POSTGRES_*`.
- `pip install -r acbc_app/requirements.txt`; `manage.py migrate`; `manage.py test`; `coverage`; `manage.py check --deploy`.
- Runs from repo root; Django via `acbc_app/`.

### Publish images job

- Uses `GITHUB_TOKEN` with `packages: write` to publish to `ghcr.io`.
- Image prefix: `ghcr.io/<owner>/<repo>`.
- Images:
  - `ghcr.io/<owner>/<repo>-backend:main`
  - `ghcr.io/<owner>/<repo>-frontend:main`
  - `ghcr.io/<owner>/<repo>-nginx:main`
- Also publishes `sha-<commit-sha>` tags.
- Frontend build args come from GitHub Repository variables:
  - `VITE_API_URL`
  - `VITE_GOOGLE_OAUTH_CLIENT_ID`

Secrets are not printed in logs.

## Scripts

- **deploy.sh**: Uses `docker-compose.prod.yml`, pulls GHCR images by default, validates config, runs migrate/collectstatic, health checks. For manual server-side builds, run `./scripts/deploy.sh --build-local`.
- **backup-db.sh** / **restore-db.sh**: Use same project root and `docker-compose.prod.yml`; same `DB_NAME`/`DB_USER` as production.

## Deployment path

On the server, use the actual project path (for example `/opt/acbc-app`):

```bash
cd /opt/acbc-app
git pull origin main
./scripts/deploy.sh
```
