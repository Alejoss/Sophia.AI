#!/bin/bash
# Migrate PostgreSQL from SQL_ASCII (or any encoding) to UTF8.
#
# PostgreSQL cannot ALTER DATABASE encoding in place. This script:
#   1. Backs up the current database
#   2. Recreates the postgres volume with UTF8 init args (from docker-compose.prod.yml)
#   3. Restores the dump into the new cluster
#
# Usage (on the production host, from repo root):
#   ./scripts/migrate-db-to-utf8.sh
#
# Requires: docker compose, docker-compose.prod.yml stack, acbc_app/.env with DB credentials.

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pre_utf8_migration_$DATE.sql.gz"

# Load DB name/user from env if present
if [ -f acbc_app/.env ]; then
    set -a
    # shellcheck disable=SC1091
    source acbc_app/.env
    set +a
fi
DB_NAME="${DB_NAME:-ACADEMIA_BLOCKCHAIN_DB}"
DB_USER="${POSTGRES_USER:-postgres}"

echo "=== PostgreSQL UTF8 migration ==="
echo ""
echo "Database: $DB_NAME (user: $DB_USER)"
echo "Backup:   $BACKUP_FILE"
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
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"
echo "Saved: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

echo ""
echo "[2/6] Stop stack..."
docker compose -f "$COMPOSE_FILE" down

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
docker compose -f "$COMPOSE_FILE" up -d postgres
for i in $(seq 1 30); do
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "$DB_USER" >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

ENCODING=$(docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -tAc "SHOW SERVER_ENCODING;")
echo "Server encoding: $ENCODING"

echo ""
echo "[5/6] Restore backup..."
gunzip -c "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"

echo ""
echo "[6/6] Start full stack..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "Migration complete. Verify:"
echo "  docker compose -f $COMPOSE_FILE exec backend python manage.py check_db_encoding"
