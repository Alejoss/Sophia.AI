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
- Verifies backend/frontend `BUILD_SHA` matches `git rev-parse HEAD` (fails if stale; use `--allow-stale-images` to override)
- Warns loudly when using `--build-local-backend` (frontend is **not** updated)
- Blocks `--build-local` when free RAM < ~3GB; recommends `--wait-for-ci` instead
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

**GitHub secrets:** `CF_API_TOKEN`, `CF_ACCOUNT_ID`, optional `CF_ZONE_NAME` / `CF_ZONE_ID`, `NOTION_API_KEY`, `NOTION_DATABASE_ID`.

**GitHub variable (optional):** `CF_NOTION_MIN_SEVERITY` — `high` (default), `medium`, or `low`.

Cloudflare → Notion rows are always **tipo = Tarea** (severity only affects title/body ordering, not tipo).

**Notion setup:**
1. Create an integration at https://www.notion.so/my-integrations
2. Copy the internal integration secret → `NOTION_API_KEY` in GitHub Actions secrets
3. Open your database → **⋯** → **Connections** → add the integration
4. Database ID from the URL (`.../p/DATABASE_ID?...`) → `NOTION_DATABASE_ID`

**Local reports (persistent):** after `git pull`, run without `--notify-notion` to save under `reports/cloudflare/` (gitignored).

**Local setup** — add to `acbc_app/.env` (see `scripts/cloudflare-report.env.example`):
```bash
CF_API_TOKEN=...
CF_ACCOUNT_ID=...
CF_ZONE_NAME=academiablockchain.com
```

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

Creates a compressed PostgreSQL dump, verifies it, optionally uploads it to a
**dedicated private S3 bucket**, and prunes old local/S3 files.

Run from the project root (directory that contains `docker-compose.prod.yml`).
Uses `docker compose -f docker-compose.prod.yml` and reads settings from
`acbc_app/.env` (shell exports override `.env`).

**Security (required for S3):**
- Use a **private** bucket (`BACKUP_S3_BUCKET`) with Block Public Access **on**.
- Use a **dedicated IAM user** whose keys live only in `acbc_app/.env` on the droplet.
- **Do not** reuse `AWS_STORAGE_BUCKET_NAME` (media is often `public-read`). The script **refuses** to upload when `BACKUP_S3_BUCKET` equals the media bucket name.

**Usage:**
```bash
cd /opt/acbc-app
chmod +x scripts/backup-db.sh
# Prefer BACKUP_DIR=/opt/backups in acbc_app/.env, then:
./scripts/backup-db.sh
```

**What it does:**
1. `pg_dump` via `docker compose exec -T postgres` → `backup_YYYYMMDD_HHMMSS.sql.gz`
2. Integrity checks: non-empty, minimum size (`BACKUP_MIN_BYTES`, default 1024), `gunzip -t`
3. If S3 is enabled: upload with SSE-S3 (`AES256`) to `s3://$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX/`
4. Prune local files older than `BACKUP_RETENTION_DAYS` and S3 objects older than `BACKUP_S3_RETENTION_DAYS`

**Variables** (optional unless noted; set in `acbc_app/.env` or the shell):

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_DIR` | `./backups` | Local output directory (set in `.env` or the shell) |
| `BACKUP_S3_BUCKET` | _(none)_ | **Required for S3 upload.** Private backup bucket name |
| `BACKUP_AWS_ACCESS_KEY_ID` / `BACKUP_AWS_SECRET_ACCESS_KEY` | _(none)_ | **Preferred** backup-only IAM keys (override `AWS_*` for uploads) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | _(none)_ | Fallback credentials if `BACKUP_AWS_*` unset |
| `AWS_S3_REGION_NAME` | `us-west-2` | Region for the backup bucket |
| `BACKUP_S3_PREFIX` | `db-backups` | Key prefix inside the backup bucket |
| `BACKUP_S3_UPLOAD` | `auto` | `auto` = upload when creds + `BACKUP_S3_BUCKET` exist; `false` disables; `true` requires them |
| `BACKUP_RETENTION_DAYS` | `7` | Local retention (days) |
| `BACKUP_S3_RETENTION_DAYS` | same as local | S3 retention (days) |
| `BACKUP_MIN_BYTES` | `1024` | Reject dumps whose **uncompressed** size is below this |
| `DB_NAME` / `DB_USER` | from `.env` or `academiablockchain_prod` / `postgres` | Dump target |

**AWS setup (one-time):**
1. Create a private S3 bucket (e.g. `acbc-db-backups`). Enable Block Public Access; no public bucket policy.
2. Create an IAM user for backups only. Attach a policy like:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListBackupPrefix",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::acbc-db-backups",
      "Condition": {
        "StringLike": { "s3:prefix": ["db-backups", "db-backups/*"] }
      }
    },
    {
      "Sid": "ObjectRW",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::acbc-db-backups/db-backups/*"
    }
  ]
}
```

3. Put the backup IAM keys and bucket name in `acbc_app/.env` on the droplet (keep media keys on `AWS_*`):

```env
# Media (existing)
AWS_ACCESS_KEY_ID=AKIA...media...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=academiablockchain
AWS_S3_REGION_NAME=us-west-2

# Backups (dedicated private bucket + IAM)
BACKUP_AWS_ACCESS_KEY_ID=AKIA...backup...
BACKUP_AWS_SECRET_ACCESS_KEY=...
BACKUP_DIR=/opt/backups
BACKUP_S3_BUCKET=acbc-db-backups
BACKUP_S3_PREFIX=db-backups
BACKUP_S3_UPLOAD=auto
BACKUP_RETENTION_DAYS=7
BACKUP_S3_RETENTION_DAYS=30
```

**DigitalOcean droplet setup (one-time):**
```bash
# Ubuntu 24.04+ has no apt awscli package — install AWS CLI v2:
curl -fsSL 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o /tmp/awscliv2.zip
sudo apt-get install -y unzip
unzip -q /tmp/awscliv2.zip -d /tmp && sudo /tmp/aws/install
aws --version

sudo mkdir -p /opt/backups /var/log
sudo chown "$USER:$USER" /opt/backups
# Ensure the cron user can run docker (root, or user in the docker group)
cd /opt/acbc-app   # use your real clone path
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
# Confirm object exists and is NOT publicly readable:
#   aws s3 ls s3://acbc-db-backups/db-backups/
```

Outbound HTTPS to S3 must remain allowed (default with UFW inbound-only rules). Droplet Backups (DigitalOcean disk snapshots) are optional and do **not** replace `pg_dump` → S3.

**Automated backup (cron):** Cron has a minimal `PATH`; the script also appends common dirs, but set `PATH` in crontab for clarity. With `BACKUP_DIR` in `.env`, no prefix vars are needed.

Weekly (recommended minimum — Sundays 02:00 server time):

```bash
0 2 * * 0 cd /opt/acbc-app && PATH=/usr/local/bin:/usr/bin:/bin ./scripts/backup-db.sh >> /var/log/acbc-backup.log 2>&1
```

Daily (optional):

```bash
0 2 * * * cd /opt/acbc-app && PATH=/usr/local/bin:/usr/bin:/bin ./scripts/backup-db.sh >> /var/log/acbc-backup.log 2>&1
```

After the first scheduled run, check `/var/log/acbc-backup.log` and the S3 prefix. There is no built-in email/Sentry alert on failure — monitor that log (or a healthcheck wrapper) yourself.

**Restore from S3:**
```bash
aws s3 cp s3://acbc-db-backups/db-backups/backup_YYYYMMDD_HHMMSS.sql.gz /opt/backups/
./scripts/restore-db.sh /opt/backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

### `restore-db.sh`

Restores PostgreSQL from a local `backup_*.sql.gz` produced by `backup-db.sh`.

Run from the project root. Uses `docker compose -f docker-compose.prod.yml` and reads
`DB_NAME` / `DB_USER` from `acbc_app/.env` (or the environment). Verifies gzip integrity
before restoring. Prompts for confirmation unless `--yes` / `-y` is passed.

**Usage:**
```bash
cd /opt/acbc-app
./scripts/restore-db.sh backups/backup_20240101_120000.sql.gz
./scripts/restore-db.sh --yes /opt/backups/backup_20240101_120000.sql.gz
```

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

Common script variables (set in `acbc_app/.env` or exported). Full backup table is under [`backup-db.sh`](#backup-dbsh).

- `DB_NAME` / `DB_USER`: Database target (defaults: `academiablockchain_prod` / `postgres`)
- `BACKUP_DIR`: Local backup directory (default: `./backups`)
- `BACKUP_S3_BUCKET`: Private S3 bucket for dumps (**required** for upload; must not equal media bucket)
- `BACKUP_RETENTION_DAYS` / `BACKUP_S3_RETENTION_DAYS`: Local / S3 retention in days
- `BACKUP_S3_PREFIX` / `BACKUP_S3_UPLOAD`: Key prefix and upload mode (`auto` / `true` / `false`)

## Automated Backups

```bash
# Weekly Sunday 02:00 — adjust /opt/acbc-app to your clone path on the droplet
0 2 * * 0 cd /opt/acbc-app && PATH=/usr/local/bin:/usr/bin:/bin ./scripts/backup-db.sh >> /var/log/acbc-backup.log 2>&1
```

## Troubleshooting

### Deployment fails
- Check that all required environment variables are set
- Verify Docker is running
- Check logs: `docker compose -f docker-compose.prod.yml logs`

### SSL setup fails
- Ensure domain DNS points to server
- Check that ports 80 and 443 are open
- Verify nginx configuration

### Backup fails
- Check the postgres container is running: `docker compose -f docker-compose.prod.yml ps`
- Verify `DB_NAME` / `DB_USER` in `acbc_app/.env`
- Ensure `BACKUP_DIR` is writable
- For S3: confirm `awscli` is installed, `BACKUP_S3_BUCKET` is set to a **private** bucket, IAM allows Put/List/Delete on the prefix, and the bucket name is **not** the media bucket
- Read `/var/log/acbc-backup.log` after cron runs; cron without `PATH` often fails to find `docker`/`aws`
