# Deployment Scripts

This directory contains scripts for deploying and managing the production environment.

## Scripts

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
Creates a backup of the PostgreSQL database.

**Usage:**
```bash
chmod +x scripts/backup-db.sh
BACKUP_DIR=/path/to/backups ./scripts/backup-db.sh
```

**What it does:**
- Creates compressed database backup
- Stores in backup directory
- Automatically cleans up backups older than 7 days

### `restore-db.sh`
Restores the database from a backup file.

**Usage:**
```bash
chmod +x scripts/restore-db.sh
./scripts/restore-db.sh backups/backup_20240101_120000.sql.gz
```

**What it does:**
- Restores database from backup file
- Prompts for confirmation before proceeding

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
