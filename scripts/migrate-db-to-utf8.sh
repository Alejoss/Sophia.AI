#!/bin/bash
# Migrate PostgreSQL from SQL_ASCII (or any encoding) to UTF8.
#
# PostgreSQL cannot ALTER DATABASE encoding in place. This script:
#   1. Backs up the current database
#   2. Recreates the postgres volume with UTF8 init args (from docker-compose.prod.yml)
#   3. Restores the dump into the new cluster
#
# Usage (on the production host, from repo root):
#   bash scripts/migrate-db-to-utf8.sh
#   # or: chmod +x scripts/migrate-db-to-utf8.sh && ./scripts/migrate-db-to-utf8.sh
#
# Requires: docker compose, docker-compose.prod.yml stack, acbc_app/.env with DB credentials.
# After deploy.sh, .env.compose should exist (GHCR_IMAGE_PREFIX). If not, run deploy.sh once.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-.env.compose}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-acbc_postgres_prod}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pre_utf8_migration_$DATE.sql.gz"

read_env_key() {
    local file="$1"
    local key="$2"
    if [ ! -f "$file" ]; then
        return 0
    fi
    grep "^${key}=" "$file" 2>/dev/null | head -n 1 | cut -d '=' -f2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//'
}

compose_cmd() {
    if [ -f "$COMPOSE_ENV_FILE" ]; then
        docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" "$@"
    else
        echo "⚠️  ${COMPOSE_ENV_FILE} not found — docker compose may fail without GHCR_IMAGE_PREFIX."
        echo "   Run ./scripts/deploy.sh once, or: bash scripts/migrate-db-to-utf8.sh after creating .env.compose"
        docker compose -f "$COMPOSE_FILE" "$@"
    fi
}

postgres_exec() {
    docker exec "$POSTGRES_CONTAINER" "$@"
}

# Load DB name/user from acbc_app/.env (avoid sourcing secrets with special chars via full source when possible)
ENV_FILE="acbc_app/.env"
if [ -f "$ENV_FILE" ]; then
    DB_NAME="${DB_NAME:-$(read_env_key "$ENV_FILE" "DB_NAME")}"
    DB_NAME="${DB_NAME:-$(read_env_key "$ENV_FILE" "POSTGRES_DB")}"
    DB_USER="${DB_USER:-$(read_env_key "$ENV_FILE" "POSTGRES_USER")}"
    DB_USER="${DB_USER:-$(read_env_key "$ENV_FILE" "DB_USER")}"
fi
DB_NAME="${DB_NAME:-ACADEMIA_BLOCKCHAIN_DB}"
DB_USER="${DB_USER:-postgres}"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ Error: run this script from the project root (missing $COMPOSE_FILE)."
    exit 1
fi

echo "=== PostgreSQL UTF8 migration ==="
echo ""
echo "Database:  $DB_NAME (user: $DB_USER)"
echo "Container: $POSTGRES_CONTAINER"
echo "Backup:    $BACKUP_FILE"
echo ""
echo "This will stop postgres, DELETE its data volume, recreate it as UTF8, and restore."
read -p "Continue? (yes/no) " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Cancelled."
    exit 1
fi

mkdir -p "$BACKUP_DIR"

echo ""
echo "[1/6] Backup..."
if docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
    postgres_exec pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"
else
    compose_cmd exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"
fi

BACKUP_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "Saved: $BACKUP_FILE ($BACKUP_SIZE)"
if [ ! -s "$BACKUP_FILE" ] || [ "$(wc -c < "$BACKUP_FILE")" -lt 1000 ]; then
    echo "❌ Backup looks too small (<1KB). Aborting before destructive steps."
    exit 1
fi
if ! gunzip -t "$BACKUP_FILE" 2>/dev/null; then
    echo "❌ Backup failed gzip integrity check. Aborting."
    exit 1
fi

echo ""
echo "[2/6] Stop stack..."
compose_cmd down

echo ""
echo "[3/6] Remove postgres data volume..."
POSTGRES_VOLUME=$(docker volume ls -q | grep postgres_data | head -1 || true)
if [ -z "$POSTGRES_VOLUME" ]; then
    echo "No postgres_data volume found (may already be fresh)."
else
    docker volume rm "$POSTGRES_VOLUME"
    echo "Removed volume: $POSTGRES_VOLUME"
fi

echo ""
echo "[4/6] Start postgres (UTF8 via POSTGRES_INITDB_ARGS in compose)..."
compose_cmd up -d postgres
for i in $(seq 1 30); do
    if compose_cmd exec -T postgres pg_isready -U "$DB_USER" >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

ENCODING=$(compose_cmd exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -tAc "SHOW SERVER_ENCODING;")
echo "Server encoding: $ENCODING"

echo ""
echo "[5/6] Restore backup..."
gunzip -c "$BACKUP_FILE" | compose_cmd exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"

echo ""
echo "[6/6] Start full stack..."
compose_cmd up -d

echo ""
echo "Migration complete. Verify:"
echo "  compose_cmd exec backend python manage.py check_db_encoding"
if [ -f "$COMPOSE_ENV_FILE" ]; then
    echo "  docker compose --env-file $COMPOSE_ENV_FILE -f $COMPOSE_FILE exec backend python manage.py check_db_encoding"
else
    echo "  docker compose -f $COMPOSE_FILE exec backend python manage.py check_db_encoding"
fi
