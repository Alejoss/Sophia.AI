#!/bin/bash

# Database Restore Script
# Restores PostgreSQL from a local backup_*.sql.gz created by backup-db.sh.
#
# Run from the project root. Reads DB_NAME / DB_USER from acbc_app/.env
# (or the environment). Uses docker-compose.prod.yml like backup-db.sh.
#
# Usage:
#   ./scripts/restore-db.sh backups/backup_20240101_120000.sql.gz
#   ./scripts/restore-db.sh --yes /opt/backups/backup_20240101_120000.sql.gz
#
# Restore from S3 (download first, then restore):
#   aws s3 cp s3://YOUR_BACKUP_BUCKET/db-backups/backup_YYYYMMDD_HHMMSS.sql.gz /opt/backups/
#   ./scripts/restore-db.sh /opt/backups/backup_YYYYMMDD_HHMMSS.sql.gz

set -euo pipefail

# Cron often has a minimal PATH; append common dirs without shadowing an existing PATH.
export PATH="${PATH:-/usr/bin:/bin}:/usr/local/bin:/usr/bin:/bin"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-.env.compose}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE="acbc_app/.env"
ASSUME_YES=0
BACKUP_FILE=""

usage() {
    echo "Usage: ./scripts/restore-db.sh [--yes|-y] <backup-file.sql.gz>"
    echo "Example: ./scripts/restore-db.sh backups/backup_20240101_120000.sql.gz"
    echo "         ./scripts/restore-db.sh --yes /opt/backups/backup_20240101_120000.sql.gz"
}

read_env_key() {
    local file="$1"
    local key="$2"
    local value=""
    if [ ! -f "$file" ]; then
        return 0
    fi
    # Missing keys must not fail under `set -o pipefail` (grep exit 1).
    value="$(grep "^${key}=" "$file" 2>/dev/null | head -n 1 | cut -d '=' -f2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//' || true)"
    printf '%s' "$value"
}

compose_cmd() {
    if [ -f "$COMPOSE_ENV_FILE" ]; then
        docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" "$@"
    else
        docker compose -f "$COMPOSE_FILE" "$@"
    fi
}

load_config() {
    if [ -f "$ENV_FILE" ]; then
        DB_NAME="${DB_NAME:-$(read_env_key "$ENV_FILE" "DB_NAME")}"
        DB_NAME="${DB_NAME:-$(read_env_key "$ENV_FILE" "POSTGRES_DB")}"
        DB_USER="${DB_USER:-$(read_env_key "$ENV_FILE" "DB_USER")}"
        DB_USER="${DB_USER:-$(read_env_key "$ENV_FILE" "POSTGRES_USER")}"
    fi
    DB_NAME="${DB_NAME:-academiablockchain_prod}"
    DB_USER="${DB_USER:-postgres}"
}

while [ $# -gt 0 ]; do
    case "$1" in
        --yes|-y)
            ASSUME_YES=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            echo "❌ Unknown option: $1"
            usage
            exit 1
            ;;
        *)
            if [ -n "$BACKUP_FILE" ]; then
                echo "❌ Unexpected argument: $1"
                usage
                exit 1
            fi
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

if [ -z "$BACKUP_FILE" ]; then
    usage
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ Error: run this script from the project root (missing $COMPOSE_FILE)."
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    echo "❌ docker not found in PATH=${PATH}"
    exit 1
fi

if ! gunzip -t "$BACKUP_FILE" 2>/dev/null; then
    echo "❌ Backup failed gzip integrity check: $BACKUP_FILE"
    exit 1
fi

load_config

echo "⚠️  WARNING: This will replace the current database!"
echo "   File:     $BACKUP_FILE"
echo "   Database: $DB_NAME"
echo "   User:     $DB_USER"

if [ "$ASSUME_YES" -ne 1 ]; then
    read -r -p "Are you sure you want to continue? (yes/no) " REPLY
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Restore cancelled."
        exit 1
    fi
fi

echo "📦 Restoring database from: $BACKUP_FILE"
gunzip -c "$BACKUP_FILE" | compose_cmd exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"

echo "✅ Database restored successfully!"
