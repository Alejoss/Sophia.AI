# CI/CD flow

## Overview

| Stage | When it runs | What it does |
|-------|----------------|--------------|
| **Detect changes** | Every push/PR to `main` | Decides which components changed (backend, frontend, nginx, CI config). |
| **Backend tests** | Backend, compose, deploy script, or CI workflow changed | Django tests + `check --deploy`. |
| **Frontend check** | Frontend, compose, deploy script, or CI workflow changed | `npm ci` + `npm run build`. |
| **Publish images** | Push to `main` or manual dispatch only | Builds/pushes only the images for components that changed. |
| **Deploy** | Manual on server | `git pull` + wait for CI + `./scripts/deploy.sh` (pull GHCR + rolling recreate + verify BUILD_SHA). |

## GitHub Actions ([.github/workflows/deploy.yml](../../.github/workflows/deploy.yml))

### Concurrency

- One active run per branch; newer pushes cancel older in-progress runs.

### Detect changes

Uses [dorny/paths-filter](https://github.com/dorny/paths-filter) to map paths to components:

- **backend**: `acbc_app/**`, `docker-compose*.yml`, `scripts/deploy.sh`
- **frontend**: `frontend/**`, `docker-compose*.yml`, `scripts/deploy.sh`
- **nginx**: `nginx/**`, `docker-compose*.yml`, `scripts/deploy.sh`
- **ci**: `.github/workflows/**` (triggers all checks and all image publishes)

Docs-only changes (for example `*.md` outside those paths) skip tests and image builds.

**Manual dispatch** (`workflow_dispatch`) builds and validates all components.

### Backend tests

- Python **3.12**, PostgreSQL 15 service.
- Runs only when backend-related paths (or CI workflow) changed.
- Timeout: 30 minutes.

### Frontend check

- Node **18**, `npm ci` then `npm run build`.
- Runs only when frontend-related paths (or CI workflow) changed.
- `VITE_*` from GitHub Repository variables, with CI fallbacks for the build step.
- Timeout: 20 minutes.

### Publish images (GHCR)

- **Not run on pull requests** (validation only on PRs).
- **Split into three jobs** (`publish-backend`, `publish-frontend`, `publish-nginx`) that run in parallel when their component changed.
- Each job has `packages: write` only where needed; workflow default is `contents: read`.
- Tags: `main` and `sha-<full-commit-sha>`.
- Frontend publish requires `VITE_API_URL` and `VITE_GOOGLE_OAUTH_CLIENT_ID` repository variables.
- Docker Buildx cache: `type=gha` per component.

Skipped jobs (for example tests when only nginx changed) do not block publish jobs.

## Server deploy ([scripts/deploy.sh](../../scripts/deploy.sh))

Default flow (safer for uptime):

1. Validate `acbc_app/.env`
2. Prepare `.env.compose` (DB creds, `GHCR_IMAGE_PREFIX`, `IMAGE_TAG`, `NGINX_CONF` if SSL config exists)
3. **Pull** images from GHCR (`pull_policy: always` on services; or `--build-local` to build on server)
4. **`docker compose up -d --force-recreate`** (rolling recreate; stack stays up during pull)
5. Migrate, collectstatic, health checks
6. **Verify** `BUILD_SHA` inside backend/frontend containers matches `git rev-parse HEAD` (fails deploy if stale; override with `--allow-stale-images`)

**Common pitfall:** `./scripts/deploy.sh --build-local-backend` recreates **only** the backend container. Frontend/nginx images are unchanged — React fixes will not appear.

Use `--full-down` only when you need a full `docker compose down` before `up` (more downtime).

## Deployment path

```bash
cd /opt/acbc-app
git pull origin main
./scripts/deploy.sh --wait-for-ci
```

**Low-RAM droplet:** never `--build-local` (frontend `npm run build` OOMs). CI builds on GitHub; the server only pulls images.

**Common pitfall:** `./scripts/deploy.sh --build-local-backend` recreates **only** the backend container. Frontend/nginx images are unchanged — React fixes will not appear.

Optional: pin a specific image tag:

```bash
IMAGE_TAG=sha-<commit-sha> ./scripts/deploy.sh
```

If GHCR packages are private:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin
```
