#!/bin/bash

# Database Backup Script
# Creates a compressed PostgreSQL dump, verifies it, optionally uploads to a
# private S3 bucket, and prunes old local/S3 backups.
#
# Prefer a dedicated private bucket (BACKUP_S3_BUCKET) + IAM user for backups.
# Do not store dumps in the public media bucket (AWS_STORAGE_BUCKET_NAME).
#
# Credentials (in order of preference for the upload step):
#   BACKUP_AWS_ACCESS_KEY_ID / BACKUP_AWS_SECRET_ACCESS_KEY  (backup-only IAM)
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY                 (fallback)
#
# Run from the project root (directory that contains docker-compose.prod.yml).
# Reads DB/AWS/BACKUP_* settings from acbc_app/.env (or the environment).
#
# Example:
#   BACKUP_DIR=/opt/backups ./scripts/backup-db.sh
#
# Cron (set PATH so docker/aws are found):
#   0 2 * * * cd /opt/acbc-app && PATH=/usr/local/bin:/usr/bin:/bin \
#     BACKUP_DIR=/opt/backups ./scripts/backup-db.sh >> /var/log/acbc-backup.log 2>&1

set -euo pipefail

# Cron often has a minimal PATH; append common dirs without shadowing an existing PATH.
export PATH="${PATH:-/usr/bin:/bin}:/usr/local/bin:/usr/bin:/bin"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Shell-exported values win; otherwise load_config() fills from acbc_app/.env, then defaults.
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-}"
BACKUP_S3_RETENTION_DAYS="${BACKUP_S3_RETENTION_DAYS:-}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-}"
BACKUP_S3_UPLOAD="${BACKUP_S3_UPLOAD:-}"
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-}"
BACKUP_MIN_BYTES="${BACKUP_MIN_BYTES:-}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-.env.compose}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE="acbc_app/.env"

DATE="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql.gz"

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

        AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-$(read_env_key "$ENV_FILE" "AWS_ACCESS_KEY_ID")}"
        AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-$(read_env_key "$ENV_FILE" "AWS_SECRET_ACCESS_KEY")}"
        AWS_STORAGE_BUCKET_NAME="${AWS_STORAGE_BUCKET_NAME:-$(read_env_key "$ENV_FILE" "AWS_STORAGE_BUCKET_NAME")}"
        AWS_S3_REGION_NAME="${AWS_S3_REGION_NAME:-$(read_env_key "$ENV_FILE" "AWS_S3_REGION_NAME")}"

        # Optional backup-only IAM (preferred when media uses different keys in the same .env).
        BACKUP_AWS_ACCESS_KEY_ID="${BACKUP_AWS_ACCESS_KEY_ID:-$(read_env_key "$ENV_FILE" "BACKUP_AWS_ACCESS_KEY_ID")}"
        BACKUP_AWS_SECRET_ACCESS_KEY="${BACKUP_AWS_SECRET_ACCESS_KEY:-$(read_env_key "$ENV_FILE" "BACKUP_AWS_SECRET_ACCESS_KEY")}"

        BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-$(read_env_key "$ENV_FILE" "BACKUP_S3_BUCKET")}"
        BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-$(read_env_key "$ENV_FILE" "BACKUP_S3_PREFIX")}"
        BACKUP_S3_UPLOAD="${BACKUP_S3_UPLOAD:-$(read_env_key "$ENV_FILE" "BACKUP_S3_UPLOAD")}"
        BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-$(read_env_key "$ENV_FILE" "BACKUP_RETENTION_DAYS")}"
        BACKUP_S3_RETENTION_DAYS="${BACKUP_S3_RETENTION_DAYS:-$(read_env_key "$ENV_FILE" "BACKUP_S3_RETENTION_DAYS")}"
        BACKUP_MIN_BYTES="${BACKUP_MIN_BYTES:-$(read_env_key "$ENV_FILE" "BACKUP_MIN_BYTES")}"
    fi

    DB_NAME="${DB_NAME:-academiablockchain_prod}"
    DB_USER="${DB_USER:-postgres}"
    AWS_S3_REGION_NAME="${AWS_S3_REGION_NAME:-us-west-2}"
    BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-db-backups}"
    BACKUP_S3_UPLOAD="${BACKUP_S3_UPLOAD:-auto}"
    BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
    BACKUP_S3_RETENTION_DAYS="${BACKUP_S3_RETENTION_DAYS:-$BACKUP_RETENTION_DAYS}"
    BACKUP_MIN_BYTES="${BACKUP_MIN_BYTES:-1024}"

    # Prefer dedicated backup IAM keys when set; otherwise fall back to AWS_*.
    if [ -n "${BACKUP_AWS_ACCESS_KEY_ID:-}" ]; then
        AWS_ACCESS_KEY_ID="$BACKUP_AWS_ACCESS_KEY_ID"
    fi
    if [ -n "${BACKUP_AWS_SECRET_ACCESS_KEY:-}" ]; then
        AWS_SECRET_ACCESS_KEY="$BACKUP_AWS_SECRET_ACCESS_KEY"
    fi
}

should_upload_to_s3() {
    case "${BACKUP_S3_UPLOAD,,}" in
        0|false|no|off|disabled)
            return 1
            ;;
        1|true|yes|on|enabled)
            ;;
        auto|*)
            if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ] || [ -z "${BACKUP_S3_BUCKET:-}" ]; then
                return 1
            fi
            ;;
    esac

    if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
        echo "❌ S3 upload enabled but AWS credentials are missing."
        echo "   Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (backup IAM user) in acbc_app/.env"
        exit 1
    fi

    if [ -z "${BACKUP_S3_BUCKET:-}" ]; then
        echo "❌ S3 upload enabled but BACKUP_S3_BUCKET is not set."
        echo "   Use a dedicated *private* S3 bucket for database dumps."
        echo "   Do not reuse AWS_STORAGE_BUCKET_NAME (media is often public-read)."
        exit 1
    fi

    if [ -n "${AWS_STORAGE_BUCKET_NAME:-}" ] && [ "$BACKUP_S3_BUCKET" = "$AWS_STORAGE_BUCKET_NAME" ]; then
        echo "❌ BACKUP_S3_BUCKET must not equal AWS_STORAGE_BUCKET_NAME."
        echo "   Media buckets are typically public-read; database dumps must stay private."
        echo "   Create a separate private bucket and set BACKUP_S3_BUCKET to its name."
        exit 1
    fi

    if ! command -v aws >/dev/null 2>&1; then
        echo "❌ S3 upload enabled but AWS CLI is not installed."
        echo "   Install with: sudo apt install -y awscli"
        exit 1
    fi

    return 0
}

verify_backup_file() {
    local compressed_bytes
    local uncompressed_bytes
    if [ ! -s "$BACKUP_FILE" ]; then
        echo "❌ Backup file is missing or empty: $BACKUP_FILE"
        exit 1
    fi

    if ! gunzip -t "$BACKUP_FILE" 2>/dev/null; then
        echo "❌ Backup failed gzip integrity check: $BACKUP_FILE"
        exit 1
    fi

    # Compare uncompressed size — gzip of tiny dumps can look fine as a .gz file.
    compressed_bytes="$(wc -c < "$BACKUP_FILE" | tr -d ' ')"
    uncompressed_bytes="$(gunzip -c "$BACKUP_FILE" | wc -c | tr -d ' ')"
    if [ "$uncompressed_bytes" -lt "$BACKUP_MIN_BYTES" ]; then
        echo "❌ Backup dump is suspiciously small (${uncompressed_bytes} uncompressed bytes; min ${BACKUP_MIN_BYTES})."
        echo "   Compressed size: ${compressed_bytes} bytes. Check postgres container and DB_NAME/DB_USER."
        exit 1
    fi
}

upload_backup_to_s3() {
    local s3_uri="s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/$(basename "$BACKUP_FILE")"
    echo "☁️  Uploading backup to ${s3_uri}..."

    AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
    AWS_DEFAULT_REGION="$AWS_S3_REGION_NAME" \
        aws s3 cp "$BACKUP_FILE" "$s3_uri" \
            --sse AES256 \
            --only-show-errors

    echo "✅ Backup uploaded to S3 (private bucket; SSE-S3)"
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

    echo "🧹 Cleaning up S3 backups older than ${BACKUP_S3_RETENTION_DAYS} day(s) in s3://${BACKUP_S3_BUCKET}/${prefix}..."

    AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
    AWS_DEFAULT_REGION="$AWS_S3_REGION_NAME" \
        aws s3 ls "s3://${BACKUP_S3_BUCKET}/${prefix}" | while read -r backup_date backup_time backup_size backup_name; do
            [ -n "${backup_name:-}" ] || continue
            case "$backup_name" in
                backup_*.sql.gz) ;;
                *) continue ;;
            esac

            local backup_epoch
            backup_epoch="$(date -d "${backup_date} ${backup_time}" +%s)"
            if [ "$backup_epoch" -lt "$cutoff_epoch" ]; then
                echo "   Deleting s3://${BACKUP_S3_BUCKET}/${prefix}${backup_name}"
                AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
                AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
                AWS_DEFAULT_REGION="$AWS_S3_REGION_NAME" \
                    aws s3 rm "s3://${BACKUP_S3_BUCKET}/${prefix}${backup_name}" --only-show-errors
            fi
        done

    echo "✅ S3 cleanup complete"
}

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ Error: run this script from the project root (missing $COMPOSE_FILE)."
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    echo "❌ docker not found in PATH=${PATH}"
    exit 1
fi

load_config

echo "📦 Creating database backup..."
mkdir -p "$BACKUP_DIR"

echo "Backing up database: $DB_NAME (user: $DB_USER)"
compose_cmd exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

verify_backup_file

echo "✅ Backup created successfully: $BACKUP_FILE"
SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "   Size: $SIZE"

if should_upload_to_s3; then
    upload_backup_to_s3
    prune_s3_backups
else
    echo "ℹ️  S3 upload skipped."
    echo "   To enable: set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and BACKUP_S3_BUCKET"
    echo "   (dedicated private bucket) in acbc_app/.env. See scripts/README.md."
fi

prune_local_backups
