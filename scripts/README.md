# Deployment Scripts

This directory contains scripts for deploying and managing the production environment.

## Fix permissions permanently (in the repo)

Git tracks file modes. If scripts are committed as non-executable (100644), every `git pull` on the server will overwrite them and you'll get "Permission denied" until you run `chmod +x` again.

**One-time fix (run locally, then push):** Mark scripts as executable in Git so every clone/pull gets them executable:

```bash
git update-index --chmod=+x scripts/deploy.sh scripts/setup-nginx.sh scripts/backup-db.sh scripts/restore-db.sh scripts/setup-ssl.sh scripts/diagnose-static-files.sh scripts/health-check.sh
git add scripts/
git commit -m "chore: track deployment scripts as executable"
git push origin main
```

After that, `git pull` on the server will keep the scripts executable.

**On the server after a pull (until the repo is fixed):** Run once per pull:
```bash
chmod +x scripts/deploy.sh scripts/setup-nginx.sh scripts/backup-db.sh scripts/restore-db.sh scripts/setup-ssl.sh scripts/health-check.sh acbc_app/entrypoint.sh
```

## Scripts

### `health-check.sh`
Checks that backend and frontend respond (via nginx). Run from project root after deploy.

**Usage:**
```bash
cd /opt/acbc-app
./scripts/health-check.sh
```

**What it does:**
- Shows container status (`docker compose ps`)
- Curls `http://localhost/health/` (backend) and `http://localhost/health` (frontend)
- Exits 0 if all pass, 1 if any fail

Uses `--env-file .env.compose` if present (same as deploy).

### `deploy.sh`
Main production deployment script. By default it pulls prebuilt images from GHCR and deploys them.

**Usage:**
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

**Common options:**
```bash
# Default: pull prebuilt GHCR images
./scripts/deploy.sh

# Intentional server-side build instead of GHCR pull
./scripts/deploy.sh --build-local

# Clean local rebuild (slower)
./scripts/deploy.sh --build-local --no-cache

# Full shutdown before up (more downtime; default is rolling recreate)
./scripts/deploy.sh --full-down

# Skip GHCR pull and use already-present local images
./scripts/deploy.sh --skip-pull
```

**What it does:**
- Validates environment configuration
- Stops existing containers
- Pulls prebuilt GHCR images, unless `--build-local` is used
- Starts services
- Runs database migrations
- Collects static files
- Performs health checks

Image names use:

```text
${GHCR_IMAGE_PREFIX}-backend:${IMAGE_TAG:-main}
${GHCR_IMAGE_PREFIX}-frontend:${IMAGE_TAG:-main}
${GHCR_IMAGE_PREFIX}-nginx:${IMAGE_TAG:-main}
```

`GHCR_IMAGE_PREFIX` is detected from the GitHub remote, or can be set in the shell/root `.env`.

### `deploy-light.sh`
Lightweight wrapper for faster deploys with less downtime.

**Usage:**
```bash
chmod +x scripts/deploy-light.sh
./scripts/deploy-light.sh
```

**What it does:**
- Runs `deploy.sh` (rolling recreate; same as default deploy)
- Pulls prebuilt GHCR images
- Keeps migrations, collectstatic, and health checks

### `setup-ssl.sh`
Sets up SSL certificates using Let's Encrypt.

**Usage:**
```bash
chmod +x scripts/setup-ssl.sh
./scripts/setup-ssl.sh yourdomain.com [email@example.com]
```

**Domain coverage behavior:**
- If you pass an apex domain (e.g. `yourdomain.com`), the certificate includes both `yourdomain.com` and `www.yourdomain.com`.
- If you pass a `www` domain (e.g. `www.yourdomain.com`), the certificate also includes the apex `yourdomain.com`.
- If you pass a subdomain (e.g. `api.yourdomain.com`), only that hostname is included.

**What it does:**
- Installs Certbot if needed
- Generates SSL certificate for your domain
- Configures nginx with SSL
- Sets up automatic certificate renewal

### `cloudflare_analytics_report.py`
Fetches Cloudflare analytics (traffic, Core Web Vitals, security events) via GraphQL and writes local reports under `reports/cloudflare/` (gitignored).

**GitHub Actions (scheduled):** `.github/workflows/cloudflare-analytics-report.yml` runs weekly, evaluates actionable insights, and **creates a Notion row** in `NOTION_DATABASE_ID` when warranted (dedup `cf-analytics-YYYY-MM-DD`). Reports on the runner are not committed.

**GitHub secrets:** `CF_*`, `NOTION_DATABASE_ID`, `NOTION_API_KEY`.

Cloudflare → Notion rows are always **tipo = Tarea** (severity only affects title/body ordering, not tipo).

**Local reports (persistent):** after `git pull`, run without `--notify-notion` to save under `reports/cloudflare/` (gitignored).

**Usage:**
```bash
python3 scripts/cloudflare_analytics_report.py
python3 scripts/cloudflare_analytics_report.py --days 14
python3 scripts/cloudflare_analytics_report.py --check
python3 scripts/cloudflare_analytics_report.py --dry-run-insights
python3 scripts/cloudflare_analytics_report.py --notify-notion
```

**Cost:** $0 (included in Cloudflare plan; subject to API rate limits).

### `backup-db.sh`
Creates a backup of the PostgreSQL database. Use the same project root and `docker-compose.prod.yml` as deployment.

**Usage:**
```bash
cd /path/to/project
chmod +x scripts/backup-db.sh
BACKUP_DIR=/path/to/backups ./scripts/backup-db.sh
```

**What it does:**
- Creates compressed database backup via `docker-compose -f docker-compose.prod.yml exec postgres pg_dump`
- Uses `DB_NAME`, `DB_USER` from env (same as prod)
- Stores in backup directory; cleans up backups older than 7 days

### `restore-db.sh`
Restores the database from a backup file. Run from project root; uses `docker-compose.prod.yml` and `DB_NAME`/`DB_USER`.

**Usage:**
```bash
cd /path/to/project
./scripts/restore-db.sh backups/backup_20240101_120000.sql.gz
```

**What it does:**
- Restores via `docker-compose -f docker-compose.prod.yml exec postgres psql`
- Prompts for confirmation before proceeding

### `setup-nginx.sh`
Sets up Nginx as a reverse proxy for the application.

**Usage:**
```bash
chmod +x scripts/setup-nginx.sh
sudo ./scripts/setup-nginx.sh
```

**What it does:**
- Installs Nginx if not already installed
- Copies nginx configuration from `nginx/nginx-server.conf`
- Enables the site configuration
- Tests and reloads Nginx
- Provides next steps for updating environment variables

**Note:** This script must be run as root (use sudo).

## Prerequisites

- Docker and Docker Compose installed
- Production `.env` file configured in `acbc_app/.env`
- Sufficient disk space for backups
- Root/sudo access for SSL setup

## Environment Variables

The scripts use the following environment variables (can be set in `.env` or exported):

- `DB_NAME`: Database name (default: academiablockchain_prod)
- `DB_USER`: Database user (default: postgres)
- `BACKUP_DIR`: Backup directory (default: ./backups)

## Automated Backups

To set up automated daily backups, add to crontab:

```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/project && ./scripts/backup-db.sh
```

## Troubleshooting

### Deployment fails
- Check that all required environment variables are set
- Verify Docker is running
- Check logs: `docker-compose -f docker-compose.prod.yml logs`

### SSL setup fails
- Ensure domain DNS points to server
- Check that ports 80 and 443 are open
- Verify nginx configuration

### Backup fails
- Check database container is running
- Verify database credentials
- Ensure backup directory is writable
