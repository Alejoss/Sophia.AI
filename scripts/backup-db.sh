#!/bin/bash

# Database Backup Script
# Creates a backup of the PostgreSQL database

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql.gz"

echo "📦 Creating database backup..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Get database name from environment or use default
DB_NAME=${DB_NAME:-academiablockchain_prod}
DB_USER=${DB_USER:-postgres}

# Create backup
echo "Backing up database: $DB_NAME"
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup created successfully: $BACKUP_FILE"
    
    # Get file size
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "   Size: $SIZE"
    
    # Clean up old backups (keep last 7 days)
    echo "🧹 Cleaning up old backups (keeping last 7 days)..."
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +7 -delete
    echo "✅ Cleanup complete"
else
    echo "❌ Backup failed!"
    exit 1
fi
