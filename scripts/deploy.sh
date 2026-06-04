#!/bin/bash

# Production Deployment Script for Digital Ocean
# This script pulls prebuilt GHCR images and deploys the application to production.

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Starting production deployment..."

usage() {
    cat <<EOF
Usage: ./scripts/deploy.sh [options]

Options:
  --build-local-backend    Build only the backend image locally (fast; use for API/Python changes)
  --build-local            Build ALL images locally (backend + frontend + nginx; slow)
  --no-cache               Build local Docker images without cache (requires a --build-local* flag)
  --skip-pull              Skip pulling GHCR images before starting services
  --skip-build             Deprecated no-op; deploy no longer builds by default
  --skip-down              Deprecated: default is rolling recreate without full down
  --full-down              Stop all containers (docker compose down) before starting
  --allow-non-production   Allow deploy when ENVIRONMENT is not PRODUCTION
  -h, --help               Show this help
EOF
}

NO_CACHE_BUILD=false
LOCAL_BUILD=false
LOCAL_BUILD_BACKEND_ONLY=false
SKIP_PULL=false
FULL_DOWN=false
ALLOW_NON_PRODUCTION=false

for arg in "$@"; do
    case "$arg" in
        --build-local-backend) LOCAL_BUILD=true; LOCAL_BUILD_BACKEND_ONLY=true ;;
        --build-local) LOCAL_BUILD=true ;;
        --no-cache) NO_CACHE_BUILD=true ;;
        --skip-pull) SKIP_PULL=true ;;
        --skip-build)
            echo "--skip-build is deprecated; production deploys no longer build by default."
            ;;
        --skip-down)
            echo "--skip-down is deprecated; rolling recreate is already the default."
            ;;
        --full-down) FULL_DOWN=true ;;
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
' acbc_app/.env > "${COMPOSE_ENV_FILE}.db"

if ! GHCR_IMAGE_PREFIX="$(detect_ghcr_image_prefix)"; then
    echo -e "${RED}❌ Error: GHCR_IMAGE_PREFIX could not be detected from git remote.${NC}"
    echo "Set GHCR_IMAGE_PREFIX in the shell or root .env, for example:"
    echo "  GHCR_IMAGE_PREFIX=ghcr.io/owner/repo"
    exit 1
fi

IMAGE_TAG="${IMAGE_TAG:-$(read_key_from_env_file ".env" "IMAGE_TAG")}"
IMAGE_TAG="${IMAGE_TAG:-main}"
# Use SSL nginx config if it exists (generated by setup-ssl.sh, gitignored)
if [ -f "nginx/nginx-ssl.conf" ]; then
    export NGINX_CONF=./nginx/nginx-ssl.conf
fi

# Write compose env in one shot (avoids duplicate GHCR_IMAGE_PREFIX/IMAGE_TAG from past deploys)
{
    cat "${COMPOSE_ENV_FILE}.db"
    echo "GHCR_IMAGE_PREFIX=$GHCR_IMAGE_PREFIX"
    echo "IMAGE_TAG=$IMAGE_TAG"
    if [ -n "${NGINX_CONF:-}" ]; then
        echo "NGINX_CONF=$NGINX_CONF"
    fi
} > "$COMPOSE_ENV_FILE"
rm -f "${COMPOSE_ENV_FILE}.db"

echo -e "${YELLOW}🐳 Using images: ${GHCR_IMAGE_PREFIX}-{backend,frontend,nginx}:${IMAGE_TAG}${NC}"
if [ -n "${NGINX_CONF:-}" ]; then
    echo -e "${YELLOW}🔐 Using nginx config: ${NGINX_CONF}${NC}"
fi

COMPOSE_ENV_ARGS=(--env-file "$COMPOSE_ENV_FILE")
if [ -f ".env" ]; then
    COMPOSE_ENV_ARGS+=(--env-file .env)
fi
PROD_COMPOSE_FILES=(-f docker-compose.prod.yml)
BUILD_COMPOSE_FILES=(-f docker-compose.prod.yml -f docker-compose.build.yml)

# Port 80 must be free for host nginx/apache, or already owned by this Docker stack (rolling recreate).
port_80_in_use() {
  if command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null | grep -q ':80 '
  elif command -v lsof >/dev/null 2>&1; then
    lsof -i :80 -t >/dev/null 2>&1
  else
    return 1
  fi
}

port_80_used_by_docker() {
  if command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null | grep ':80 ' | grep -qE 'docker|docker-proxy'
  else
    docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -qE 'acbc_nginx|:80->'
  fi
}

if port_80_in_use; then
  if port_80_used_by_docker; then
    echo -e "${YELLOW}ℹ️  Port 80 is in use by Docker (existing stack); continuing rolling deploy.${NC}"
  else
    echo -e "${YELLOW}🔓 Port 80 in use by host service; stopping nginx/apache so container can bind...${NC}"
    (sudo systemctl stop nginx 2>/dev/null || systemctl stop nginx 2>/dev/null || true)
    (sudo systemctl stop apache2 2>/dev/null || systemctl stop apache2 2>/dev/null || true)
    sleep 2
    if port_80_in_use && ! port_80_used_by_docker; then
      echo -e "${RED}❌ Port 80 still in use by a non-Docker process.${NC}"
      echo "Inspect with: ss -tlnp | grep ':80'"
      echo "Stop it (e.g. sudo systemctl stop nginx) or free the port, then re-run."
      exit 1
    fi
  fi
fi

# Pull or build images before stopping the stack (avoids downtime if pull/build fails).
if [ "$LOCAL_BUILD" = true ]; then
  if [ ! -f "docker-compose.build.yml" ]; then
    echo -e "${RED}❌ docker-compose.build.yml not found; cannot run local build.${NC}"
    exit 1
  fi

  export BUILD_SHA="$(git rev-parse HEAD 2>/dev/null || echo local)"

  BUILD_FLAGS=""
  if [ "$NO_CACHE_BUILD" = true ]; then
    BUILD_FLAGS="--no-cache"
  fi

  if [ "$LOCAL_BUILD_BACKEND_ONLY" = true ]; then
    echo -e "${YELLOW}🔨 Building backend image only (frontend/nginx unchanged)...${NC}"
    echo -e "${YELLOW}   BUILD_SHA=${BUILD_SHA}${NC}"
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${BUILD_COMPOSE_FILES[@]}" build $BUILD_FLAGS backend
  else
    echo -e "${YELLOW}🔨 Building ALL images locally (this can take 30+ minutes)...${NC}"
    echo -e "${YELLOW}   Tip: for API-only changes use --build-local-backend instead.${NC}"
    echo -e "${YELLOW}   BUILD_SHA=${BUILD_SHA}${NC}"
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${BUILD_COMPOSE_FILES[@]}" build $BUILD_FLAGS
  fi
else
  if [ "$NO_CACHE_BUILD" = true ]; then
    echo -e "${YELLOW}⚠️  Ignoring --no-cache because this deploy pulls prebuilt images. Use --build-local --no-cache for a local rebuild.${NC}"
  fi

  if [ "$SKIP_PULL" = true ]; then
    echo -e "${YELLOW}⏭️  Skipping image pull (--skip-pull)${NC}"
  else
    echo -e "${YELLOW}📥 Pulling prebuilt images from GHCR (backend tag: ${IMAGE_TAG})...${NC}"
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" pull
    BACKEND_IMAGE="${GHCR_IMAGE_PREFIX}-backend:${IMAGE_TAG}"
    echo -e "${YELLOW}   Backend image: ${BACKEND_IMAGE}${NC}"
    docker image inspect "$BACKEND_IMAGE" --format '   Created: {{.Created}}  Id: {{.Id}}' 2>/dev/null || true
  fi
fi

if [ "$FULL_DOWN" = true ]; then
    echo -e "${YELLOW}📦 Stopping existing containers (--full-down)...${NC}"
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" down || true
    sleep 2
fi

# Start or recreate services with the pulled/built images (default: rolling recreate).
echo -e "${YELLOW}🚀 Starting services...${NC}"
if [ "$LOCAL_BUILD_BACKEND_ONLY" = true ]; then
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" up -d --no-deps --force-recreate backend
elif [ "$FULL_DOWN" = true ]; then
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" up -d
else
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" up -d --force-recreate --remove-orphans
fi

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

# Verify backend container includes expected application code (GHCR :main can be stale)
echo -e "${YELLOW}🔎 Verifying backend image contents...${NC}"
BACKEND_BUILD_SHA="$(docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" exec -T backend cat /app/.build_sha 2>/dev/null | tr -d '\r' || true)"
LOCAL_GIT_SHA="$(git rev-parse HEAD 2>/dev/null || true)"
if docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" exec -T backend test -f /app/content/views_youtube_migration.py 2>/dev/null; then
    echo -e "${GREEN}✅ Backend image contains current app code (youtube migration module present)${NC}"
    if [ -n "$BACKEND_BUILD_SHA" ] && [ -n "$LOCAL_GIT_SHA" ]; then
        echo -e "${GREEN}   Image BUILD_SHA=${BACKEND_BUILD_SHA}  git HEAD=${LOCAL_GIT_SHA}${NC}"
        if [ "$BACKEND_BUILD_SHA" != "$LOCAL_GIT_SHA" ]; then
            echo -e "${YELLOW}   ⚠️  Image SHA differs from git HEAD. If you expect latest code, run: ./scripts/deploy.sh --build-local${NC}"
        fi
    fi
else
    echo -e "${RED}❌ Backend container is missing code from this git checkout (stale GHCR image).${NC}"
    echo -e "${RED}   Running container image: $(docker inspect acbc_backend_prod --format '{{.Config.Image}}' 2>/dev/null || echo unknown)${NC}"
    echo -e "${RED}   Fix: ./scripts/deploy.sh --build-local-backend   (backend only, ~few min)${NC}"
    echo -e "${RED}   Or set IMAGE_TAG to the commit SHA published by GitHub Actions, then redeploy.${NC}"
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
