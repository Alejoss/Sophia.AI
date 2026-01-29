#!/bin/bash

# Database Restore Script
# Restores a PostgreSQL database from a backup file

set -e

if [ -z "$1" ]; then
    echo "Usage: ./restore-db.sh <backup-file.sql.gz>"
    echo "Example: ./restore-db.sh backups/backup_20240101_120000.sql.gz"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will replace the current database!"
read -p "Are you sure you want to continue? (yes/no) " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Restore cancelled."
    exit 1
fi

# Get database name from environment or use default
DB_NAME=${DB_NAME:-academiablockchain_prod}
DB_USER=${DB_USER:-postgres}

echo "📦 Restoring database from: $BACKUP_FILE"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"

# Restore backup
gunzip -c "$BACKUP_FILE" | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"

if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully!"
else
    echo "❌ Restore failed!"
    exit 1
fi
