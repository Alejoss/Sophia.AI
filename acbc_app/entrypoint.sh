#!/bin/bash
set -e

# Entrypoint script that chooses command based on ENVIRONMENT variable
# If ENVIRONMENT=PRODUCTION, use Gunicorn
# If ENVIRONMENT=DEVELOPMENT or not set, use Django runserver

# Default to DEVELOPMENT if not set
ENVIRONMENT=${ENVIRONMENT:-DEVELOPMENT}

if [ "$ENVIRONMENT" = "PRODUCTION" ]; then
    # Production: Use Gunicorn
    echo "Starting Gunicorn (PRODUCTION mode)..."
    exec gunicorn academia_blockchain.wsgi:application \
        --bind 0.0.0.0:8000 \
        --workers 3 \
        --timeout 600 \
        --access-logfile - \
        --error-logfile -
else
    # Development: Use Django runserver
    echo "Starting Django development server (DEVELOPMENT mode)..."
    exec python manage.py runserver 0.0.0.0:8000
fi
