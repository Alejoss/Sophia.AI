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

# Stop existing containers
echo -e "${YELLOW}📦 Stopping existing containers...${NC}"
docker-compose -f docker-compose.prod.yml down || true

# Build images
echo -e "${YELLOW}🔨 Building Docker images...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache

# Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Run database migrations
echo -e "${YELLOW}📊 Running database migrations...${NC}"
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py migrate --noinput

# Collect static files
echo -e "${YELLOW}📁 Collecting static files...${NC}"
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput

# Check service health
echo -e "${YELLOW}🏥 Checking service health...${NC}"
sleep 5

# Check backend health
if curl -f http://localhost/health/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend health check passed${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    docker-compose -f docker-compose.prod.yml logs backend
    exit 1
fi

# Check frontend health
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend health check passed${NC}"
else
    echo -e "${RED}❌ Frontend health check failed${NC}"
    docker-compose -f docker-compose.prod.yml logs frontend
    exit 1
fi

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "Services are running:"
echo "  - Frontend: http://localhost"
echo "  - Backend API: http://localhost/api"
echo "  - Admin: http://localhost/admin"
echo ""
echo "To view logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "To stop services: docker-compose -f docker-compose.prod.yml down"
