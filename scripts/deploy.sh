#!/bin/bash

# Production Deployment Script for Digital Ocean
# This script builds and deploys the application to production

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Starting production deployment..."

usage() {
    cat <<EOF
Usage: ./scripts/deploy.sh [options]

Options:
  --build-local            Build Docker images on this server instead of pulling GHCR images
  --no-cache               Build local Docker images without cache (requires --build-local)
  --skip-pull              Skip pulling GHCR images before starting services
  --skip-build             Deprecated no-op; deploy no longer builds by default
  --skip-down              Do not run 'docker compose down' before deployment
  --allow-non-production   Allow deploy when ENVIRONMENT is not PRODUCTION
  -h, --help               Show this help
EOF
}

NO_CACHE_BUILD=false
LOCAL_BUILD=false
SKIP_PULL=false
SKIP_DOWN=false
ALLOW_NON_PRODUCTION=false

for arg in "$@"; do
    case "$arg" in
        --build-local) LOCAL_BUILD=true ;;
        --no-cache) NO_CACHE_BUILD=true ;;
        --skip-pull) SKIP_PULL=true ;;
        --skip-build)
            echo "--skip-build is deprecated; production deploys no longer build by default."
            ;;
        --skip-down) SKIP_DOWN=true ;;
        --allow-non-production) ALLOW_NON_PRODUCTION=true ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $arg"
            usage
            exit 1
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

read_key_from_env_file() {
    local file="$1"
    local key="$2"

    if [ ! -f "$file" ]; then
        return 0
    fi

    awk -v key="$key" -F= '$1 == key { sub(/^[^=]*=/, ""); gsub(/^[ \t"\047]+|[ \t"\047]+$/, ""); print; exit }' "$file"
}

detect_ghcr_image_prefix() {
    local configured="${GHCR_IMAGE_PREFIX:-}"
    local remote_url=""
    local repo_path=""

    if [ -z "$configured" ]; then
        configured="$(read_key_from_env_file ".env" "GHCR_IMAGE_PREFIX")"
    fi

    if [ -n "$configured" ]; then
        printf '%s\n' "$configured" | tr '[:upper:]' '[:lower:]'
        return 0
    fi

    remote_url="$(git config --get remote.origin.url 2>/dev/null || true)"
    case "$remote_url" in
        git@github.com:*) repo_path="${remote_url#git@github.com:}" ;;
        https://github.com/*) repo_path="${remote_url#https://github.com/}" ;;
        http://github.com/*) repo_path="${remote_url#http://github.com/}" ;;
        ssh://git@github.com/*) repo_path="${remote_url#ssh://git@github.com/}" ;;
    esac

    repo_path="${repo_path%.git}"
    if [ -z "$repo_path" ]; then
        return 1
    fi

    printf 'ghcr.io/%s\n' "$(printf '%s' "$repo_path" | tr '[:upper:]' '[:lower:]')"
}

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
    if [ "$ALLOW_NON_PRODUCTION" = true ]; then
        echo -e "${YELLOW}⚠️  ENVIRONMENT is not PRODUCTION, continuing due to --allow-non-production${NC}"
    else
        echo -e "${RED}❌ Error: ENVIRONMENT is not set to PRODUCTION.${NC}"
        echo "Set ENVIRONMENT=PRODUCTION in acbc_app/.env or run with --allow-non-production."
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

if ! GHCR_IMAGE_PREFIX="$(detect_ghcr_image_prefix)"; then
    echo -e "${RED}❌ Error: GHCR_IMAGE_PREFIX could not be detected from git remote.${NC}"
    echo "Set GHCR_IMAGE_PREFIX in the shell or root .env, for example:"
    echo "  GHCR_IMAGE_PREFIX=ghcr.io/owner/repo"
    exit 1
fi

IMAGE_TAG="${IMAGE_TAG:-$(read_key_from_env_file ".env" "IMAGE_TAG")}"
IMAGE_TAG="${IMAGE_TAG:-main}"
{
    echo "GHCR_IMAGE_PREFIX=$GHCR_IMAGE_PREFIX"
    echo "IMAGE_TAG=$IMAGE_TAG"
} >> "$COMPOSE_ENV_FILE"

echo -e "${YELLOW}🐳 Using images: ${GHCR_IMAGE_PREFIX}-{backend,frontend,nginx}:${IMAGE_TAG}${NC}"

COMPOSE_ENV_ARGS=(--env-file "$COMPOSE_ENV_FILE")
if [ -f ".env" ]; then
    COMPOSE_ENV_ARGS+=(--env-file .env)
fi
PROD_COMPOSE_FILES=(-f docker-compose.prod.yml)
BUILD_COMPOSE_FILES=(-f docker-compose.prod.yml -f docker-compose.build.yml)

# Use SSL nginx config if it exists (generated by setup-ssl.sh, gitignored)
if [ -f "nginx/nginx-ssl.conf" ]; then
    export NGINX_CONF=./nginx/nginx-ssl.conf
fi

if [ "$SKIP_DOWN" = true ]; then
    echo -e "${YELLOW}⏭️  Skipping full shutdown (--skip-down)${NC}"
else
    # Stop existing containers first (frees port 80 if our nginx container was using it)
    echo -e "${YELLOW}📦 Stopping existing containers...${NC}"
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" down || true
    sleep 2
fi

# If port 80 is still in use (e.g. host nginx/apache), stop it so our container can bind
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

# Pull prebuilt images from GHCR by default. Use --build-local only when intentionally
# rebuilding on the server (for example, while testing a Dockerfile change before merge).
if [ "$LOCAL_BUILD" = true ]; then
  echo -e "${YELLOW}🔨 Building Docker images locally...${NC}"
  if [ ! -f "docker-compose.build.yml" ]; then
    echo -e "${RED}❌ docker-compose.build.yml not found; cannot run --build-local.${NC}"
    exit 1
  fi

  BUILD_FLAGS=""
  if [ "$NO_CACHE_BUILD" = true ]; then
    BUILD_FLAGS="--no-cache"
    echo -e "${YELLOW}🧹 Using no-cache local build (slow but clean)${NC}"
  else
    echo -e "${YELLOW}⚡ Using local Docker build cache${NC}"
  fi

  docker compose "${COMPOSE_ENV_ARGS[@]}" "${BUILD_COMPOSE_FILES[@]}" build $BUILD_FLAGS
else
  if [ "$NO_CACHE_BUILD" = true ]; then
    echo -e "${YELLOW}⚠️  Ignoring --no-cache because this deploy pulls prebuilt images. Use --build-local --no-cache for a local rebuild.${NC}"
  fi

  if [ "$SKIP_PULL" = true ]; then
    echo -e "${YELLOW}⏭️  Skipping image pull (--skip-pull)${NC}"
  else
    echo -e "${YELLOW}📥 Pulling prebuilt images from GHCR...${NC}"
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" pull
  fi
fi

# Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Run database migrations
echo -e "${YELLOW}📊 Running database migrations...${NC}"
docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" exec -T backend python manage.py migrate --noinput

# Collect static files
echo -e "${YELLOW}📁 Collecting static files...${NC}"
docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" exec -T backend python manage.py collectstatic --noinput

# Check service health
echo -e "${YELLOW}🏥 Checking service health...${NC}"
sleep 5

# Check backend health
if curl -f http://localhost/health/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend health check passed${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" logs backend
    exit 1
fi

# Check frontend health
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend health check passed${NC}"
else
    echo -e "${RED}❌ Frontend health check failed${NC}"
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" logs frontend
    exit 1
fi

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "Services are running:"
echo "  - Frontend: http://localhost"
echo "  - Backend API: http://localhost/api"
echo "  - Admin: http://localhost/admin"
echo ""
echo "To view logs: docker compose --env-file $PROJECT_ROOT/.env.compose -f $PROJECT_ROOT/docker-compose.prod.yml logs -f"
echo "To stop services: docker compose --env-file $PROJECT_ROOT/.env.compose -f $PROJECT_ROOT/docker-compose.prod.yml down"
