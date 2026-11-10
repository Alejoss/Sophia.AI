#!/bin/bash
set -e

# Entrypoint script that chooses command based on ENVIRONMENT variable
# If ENVIRONMENT=PRODUCTION, use Gunicorn
# If ENVIRONMENT=DEVELOPMENT or not set, use Django runserver

# Default to DEVELOPMENT if not set
ENVIRONMENT=${ENVIRONMENT:-DEVELOPMENT}

# Named volume (production) or bind mount (development) at this path.
LOG_DIR="${LOGS_DIR:-/app/logs}"
mkdir -p "$LOG_DIR"

if [ "$ENVIRONMENT" = "PRODUCTION" ]; then
    # Production: Gunicorn. Bind, workers, timeout, and stdout/stderr are
    # flags on this command. gunicorn.conf.py only adds log files under LOG_DIR.
    echo "Starting Gunicorn (PRODUCTION mode)..."
    echo "Persisted application logs: ${LOG_DIR}"
    exec gunicorn academia_blockchain.wsgi:application \
        --bind 0.0.0.0:8000 \
        --workers 3 \
        --timeout 600 \
        --access-logfile - \
        --error-logfile - \
        --config /app/gunicorn.conf.py
else
    # Development: Use Django runserver
    echo "Starting Django development server (DEVELOPMENT mode)..."
    exec python manage.py runserver 0.0.0.0:8000
fi
