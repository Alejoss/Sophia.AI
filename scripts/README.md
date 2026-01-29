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
Main deployment script that builds and deploys the application.

**Usage:**
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

**What it does:**
- Validates environment configuration
- Stops existing containers
- Builds Docker images
- Starts services
- Runs database migrations
- Collects static files
- Performs health checks

### `setup-ssl.sh`
Sets up SSL certificates using Let's Encrypt.

**Usage:**
```bash
chmod +x scripts/setup-ssl.sh
./scripts/setup-ssl.sh yourdomain.com [email@example.com]
```

**What it does:**
- Installs Certbot if needed
- Generates SSL certificate for your domain
- Configures nginx with SSL
- Sets up automatic certificate renewal

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
