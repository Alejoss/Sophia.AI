#!/bin/bash

# Production Deployment Script for Digital Ocean
# This script builds and deploys the application to production

set -e  # Exit on any error

echo "🚀 Starting production deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f "acbc_app/.env" ]; then
    echo -e "${RED}❌ Error: acbc_app/.env file not found!${NC}"
    echo "Please create acbc_app/.env with production environment variables."
    exit 1
fi

# Check required environment variables
# Read variables directly from .env file without using source (to avoid special character issues)
# This safely extracts values even if they contain !, %, $, etc.
# Using head -n 1 to take only the first match if multiple lines exist
ACADEMIA_BLOCKCHAIN_SKEY=$(grep "^ACADEMIA_BLOCKCHAIN_SKEY=" acbc_app/.env | head -n 1 | cut -d '=' -f2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//')
ENVIRONMENT=$(grep "^ENVIRONMENT=" acbc_app/.env | head -n 1 | cut -d '=' -f2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//')

if [ -z "$ACADEMIA_BLOCKCHAIN_SKEY" ] || [ "$ACADEMIA_BLOCKCHAIN_SKEY" = "django-insecure-development-key-123" ]; then
    echo -e "${RED}❌ Error: ACADEMIA_BLOCKCHAIN_SKEY must be set to a secure value!${NC}"
    exit 1
fi

if [ "$ENVIRONMENT" != "PRODUCTION" ]; then
    echo -e "${YELLOW}⚠️  Warning: ENVIRONMENT is not set to PRODUCTION${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Verify that required database variables exist in acbc_app/.env
echo -e "${YELLOW}📋 Verifying database configuration...${NC}"
if ! grep -qE "^POSTGRES_DB=|^DB_NAME=" acbc_app/.env && ! grep -qE "^POSTGRES_USER=|^DB_USER=" acbc_app/.env && ! grep -qE "^POSTGRES_PASSWORD=|^DB_PASSWORD=" acbc_app/.env; then
    echo -e "${RED}❌ Error: Database credentials not found in acbc_app/.env${NC}"
    echo "Please ensure acbc_app/.env contains POSTGRES_DB (or DB_NAME), POSTGRES_USER (or DB_USER), and POSTGRES_PASSWORD (or DB_PASSWORD)"
    exit 1
fi

# Build env file for Docker Compose variable substitution from acbc_app/.env
# Docker Compose expands $ in .env files, so escape $ as $$ so it's treated literally
COMPOSE_ENV_FILE=".env.compose"
echo -e "${YELLOW}📄 Preparing Docker Compose env from acbc_app/.env...${NC}"
awk -v q="'" '
  /^DB_NAME=|^POSTGRES_DB=/ { sub(/^[^=]*=/, ""); gsub(/^[ \t"'\'']+|[ \t"'\'']+$/, ""); gsub(/\$/, "$$"); dbname=$0; next }
  /^DB_USER=|^POSTGRES_USER=/ { sub(/^[^=]*=/, ""); gsub(/^[ \t"'\'']+|[ \t"'\'']+$/, ""); gsub(/\$/, "$$"); dbuser=$0; next }
  /^DB_PASSWORD=|^POSTGRES_PASSWORD=/ { sub(/^[^=]*=/, ""); gsub(/^[ \t"'\'']+|[ \t"'\'']+$/, ""); gsub(/\$/, "$$"); gsub(q, q "\\" q q); dbpass=$0; next }
  END {
    print "DB_NAME=" (length(dbname) ? dbname : "academiablockchain_prod")
    print "DB_USER=" (length(dbuser) ? dbuser : "postgres")
    print "DB_PASSWORD=" q dbpass q
  }
' acbc_app/.env > "$COMPOSE_ENV_FILE"

# Free port 80 if host nginx/apache is using it (so container nginx can bind)
if command -v ss >/dev/null 2>&1; then
  if ss -tlnp 2>/dev/null | grep -q ':80 '; then
    echo -e "${YELLOW}🔓 Port 80 in use; stopping host nginx/apache so container can bind...${NC}"
    (sudo systemctl stop nginx 2>/dev/null || systemctl stop nginx 2>/dev/null || true)
    (sudo systemctl stop apache2 2>/dev/null || systemctl stop apache2 2>/dev/null || true)
    sleep 2
    if ss -tlnp 2>/dev/null | grep -q ':80 '; then
      echo -e "${RED}❌ Port 80 still in use. Stop the process using it (e.g. sudo systemctl stop nginx) and re-run.${NC}"
      exit 1
    fi
  fi
elif command -v lsof >/dev/null 2>&1; then
  if lsof -i :80 -t >/dev/null 2>&1; then
    echo -e "${YELLOW}🔓 Port 80 in use; stopping host nginx/apache so container can bind...${NC}"
    (sudo systemctl stop nginx 2>/dev/null || systemctl stop nginx 2>/dev/null || true)
    (sudo systemctl stop apache2 2>/dev/null || systemctl stop apache2 2>/dev/null || true)
    sleep 2
    if lsof -i :80 -t >/dev/null 2>&1; then
      echo -e "${RED}❌ Port 80 still in use. Stop the process using it and re-run.${NC}"
      exit 1
    fi
  fi
fi

# Stop existing containers
echo -e "${YELLOW}📦 Stopping existing containers...${NC}"
docker compose --env-file "$COMPOSE_ENV_FILE" -f docker-compose.prod.yml down || true

# Build images
echo -e "${YELLOW}🔨 Building Docker images...${NC}"
docker compose --env-file "$COMPOSE_ENV_FILE" -f docker-compose.prod.yml build --no-cache

# Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker compose --env-file "$COMPOSE_ENV_FILE" -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Run database migrations
echo -e "${YELLOW}📊 Running database migrations...${NC}"
docker compose --env-file "$COMPOSE_ENV_FILE" -f docker-compose.prod.yml exec -T backend python manage.py migrate --noinput

# Collect static files
echo -e "${YELLOW}📁 Collecting static files...${NC}"
docker compose --env-file "$COMPOSE_ENV_FILE" -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput

# Check service health
echo -e "${YELLOW}🏥 Checking service health...${NC}"
sleep 5

# Check backend health
if curl -f http://localhost/health/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend health check passed${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    docker compose --env-file "$COMPOSE_ENV_FILE" -f docker-compose.prod.yml logs backend
    exit 1
fi

# Check frontend health
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend health check passed${NC}"
else
    echo -e "${RED}❌ Frontend health check failed${NC}"
    docker compose --env-file "$COMPOSE_ENV_FILE" -f docker-compose.prod.yml logs frontend
    exit 1
fi

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "Services are running:"
echo "  - Frontend: http://localhost"
echo "  - Backend API: http://localhost/api"
echo "  - Admin: http://localhost/admin"
echo ""
echo "To view logs: docker compose --env-file $COMPOSE_ENV_FILE -f docker-compose.prod.yml logs -f"
echo "To stop services: docker compose --env-file $COMPOSE_ENV_FILE -f docker-compose.prod.yml down"
