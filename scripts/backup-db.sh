#!/bin/bash

# Database Backup Script
# Creates a compressed PostgreSQL dump and optionally uploads it to S3.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_S3_RETENTION_DAYS="${BACKUP_S3_RETENTION_DAYS:-$BACKUP_RETENTION_DAYS}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-db-backups}"
BACKUP_S3_UPLOAD="${BACKUP_S3_UPLOAD:-auto}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-.env.compose}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE="acbc_app/.env"

DATE="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql.gz"

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
        docker compose -f "$COMPOSE_FILE" "$@"
    fi
}

load_config() {
    if [ -f "$ENV_FILE" ]; then
        DB_NAME="${DB_NAME:-$(read_env_key "$ENV_FILE" "DB_NAME")}"
        DB_NAME="${DB_NAME:-$(read_env_key "$ENV_FILE" "POSTGRES_DB")}"
        DB_USER="${DB_USER:-$(read_env_key "$ENV_FILE" "DB_USER")}"
        DB_USER="${DB_USER:-$(read_env_key "$ENV_FILE" "POSTGRES_USER")}"

        AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-$(read_env_key "$ENV_FILE" "AWS_ACCESS_KEY_ID")}"
        AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-$(read_env_key "$ENV_FILE" "AWS_SECRET_ACCESS_KEY")}"
        AWS_STORAGE_BUCKET_NAME="${AWS_STORAGE_BUCKET_NAME:-$(read_env_key "$ENV_FILE" "AWS_STORAGE_BUCKET_NAME")}"
        AWS_S3_REGION_NAME="${AWS_S3_REGION_NAME:-$(read_env_key "$ENV_FILE" "AWS_S3_REGION_NAME")}"
        BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-$(read_env_key "$ENV_FILE" "BACKUP_S3_PREFIX")}"
        BACKUP_S3_UPLOAD="${BACKUP_S3_UPLOAD:-$(read_env_key "$ENV_FILE" "BACKUP_S3_UPLOAD")}"
    fi

    DB_NAME="${DB_NAME:-academiablockchain_prod}"
    DB_USER="${DB_USER:-postgres}"
    AWS_S3_REGION_NAME="${AWS_S3_REGION_NAME:-us-west-2}"
    BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-db-backups}"
    BACKUP_S3_UPLOAD="${BACKUP_S3_UPLOAD:-auto}"
}

should_upload_to_s3() {
    case "${BACKUP_S3_UPLOAD,,}" in
        0|false|no|off|disabled)
            return 1
            ;;
        1|true|yes|on|enabled)
            ;;
        auto|*)
            if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ] || [ -z "${AWS_STORAGE_BUCKET_NAME:-}" ]; then
                return 1
            fi
            ;;
    esac

    if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ] || [ -z "${AWS_STORAGE_BUCKET_NAME:-}" ]; then
        echo "❌ S3 upload enabled but AWS credentials or bucket are missing."
        echo "   Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_STORAGE_BUCKET_NAME in acbc_app/.env"
        exit 1
    fi

    if ! command -v aws >/dev/null 2>&1; then
        echo "❌ S3 upload enabled but AWS CLI is not installed."
        echo "   Install with: sudo apt install -y awscli"
        exit 1
    fi

    return 0
}

upload_backup_to_s3() {
    local s3_uri="s3://${AWS_STORAGE_BUCKET_NAME}/${BACKUP_S3_PREFIX}/$(basename "$BACKUP_FILE")"
    echo "☁️  Uploading backup to ${s3_uri}..."

    AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
    AWS_DEFAULT_REGION="$AWS_S3_REGION_NAME" \
        aws s3 cp "$BACKUP_FILE" "$s3_uri" \
            --sse AES256 \
            --only-show-errors

    echo "✅ Backup uploaded to S3"
}

prune_local_backups() {
    echo "🧹 Cleaning up local backups older than ${BACKUP_RETENTION_DAYS} day(s)..."
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime "+${BACKUP_RETENTION_DAYS}" -delete
    echo "✅ Local cleanup complete"
}

prune_s3_backups() {
    local prefix="${BACKUP_S3_PREFIX%/}/"
    local cutoff_epoch
    cutoff_epoch="$(date -d "-${BACKUP_S3_RETENTION_DAYS} days" +%s)"

    echo "🧹 Cleaning up S3 backups older than ${BACKUP_S3_RETENTION_DAYS} day(s) in s3://${AWS_STORAGE_BUCKET_NAME}/${prefix}..."

    AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
    AWS_DEFAULT_REGION="$AWS_S3_REGION_NAME" \
        aws s3 ls "s3://${AWS_STORAGE_BUCKET_NAME}/${prefix}" | while read -r backup_date backup_time backup_size backup_name; do
            [ -n "${backup_name:-}" ] || continue
            case "$backup_name" in
                backup_*.sql.gz) ;;
                *) continue ;;
            esac

            local backup_epoch
            backup_epoch="$(date -d "${backup_date} ${backup_time}" +%s)"
            if [ "$backup_epoch" -lt "$cutoff_epoch" ]; then
                echo "   Deleting s3://${AWS_STORAGE_BUCKET_NAME}/${prefix}${backup_name}"
                AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
                AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
                AWS_DEFAULT_REGION="$AWS_S3_REGION_NAME" \
                    aws s3 rm "s3://${AWS_STORAGE_BUCKET_NAME}/${prefix}${backup_name}" --only-show-errors
            fi
        done

    echo "✅ S3 cleanup complete"
}

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ Error: run this script from the project root (missing $COMPOSE_FILE)."
    exit 1
fi

load_config

echo "📦 Creating database backup..."
mkdir -p "$BACKUP_DIR"

echo "Backing up database: $DB_NAME (user: $DB_USER)"
compose_cmd exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "✅ Backup created successfully: $BACKUP_FILE"
SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "   Size: $SIZE"

if should_upload_to_s3; then
    upload_backup_to_s3
    prune_s3_backups
else
    echo "ℹ️  S3 upload skipped (set AWS credentials in acbc_app/.env to enable)."
fi

prune_local_backups
