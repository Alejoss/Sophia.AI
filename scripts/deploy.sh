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
  --allow-stale-images     Do not fail when GHCR images are older than git HEAD
  --wait-for-ci            Poll GHCR until frontend image matches git HEAD (for low-RAM servers)
  -h, --help               Show this help
EOF
}

NO_CACHE_BUILD=false
LOCAL_BUILD=false
LOCAL_BUILD_BACKEND_ONLY=false
SKIP_PULL=false
FULL_DOWN=false
ALLOW_NON_PRODUCTION=false
ALLOW_STALE_IMAGES=false
WAIT_FOR_CI=false
LOCAL_BUILD_FULL_MIN_MB=2800
LOCAL_BUILD_BACKEND_MIN_MB=1200

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
        --allow-stale-images) ALLOW_STALE_IMAGES=true ;;
        --wait-for-ci) WAIT_FOR_CI=true ;;
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

mem_available_mb() {
    if [ -r /proc/meminfo ]; then
        awk '/MemAvailable:/ {print int($2 / 1024)}' /proc/meminfo
    else
        echo 0
    fi
}

ghcr_deploy_hint() {
    echo -e "${RED}      1. Push to main and wait for GitHub Actions (job Publish frontend image).${NC}"
    echo -e "${RED}      2. On the server: ./scripts/deploy.sh --wait-for-ci${NC}"
    echo -e "${RED}      Do not use --build-local on this droplet (npm build needs ~3GB+ free RAM).${NC}"
}

require_ram_for_local_build() {
    local need_mb="$1"
    local label="$2"
    local avail_mb
    avail_mb="$(mem_available_mb)"
    if [ "$avail_mb" -lt "$need_mb" ]; then
        echo -e "${RED}❌ Not enough RAM for ${label}.${NC}"
        echo -e "${RED}   Available: ${avail_mb} MB — need at least ${need_mb} MB free.${NC}"
        ghcr_deploy_hint
        exit 1
    fi
}

image_build_sha_from_tar() {
    local image="$1"
    local path="$2"
    local cid=""
    cid="$(docker create "$image" 2>/dev/null)" || return 1
    local sha=""
    sha="$(docker cp "${cid}:${path}" - 2>/dev/null | tr -d '\r')"
    docker rm "$cid" >/dev/null 2>&1 || true
    if [ -n "$sha" ]; then
        printf '%s' "$sha"
    fi
}

wait_for_ghcr_frontend_image() {
    local max_attempts="${WAIT_FOR_CI_ATTEMPTS:-40}"
    local sleep_secs="${WAIT_FOR_CI_SLEEP:-90}"
    local attempt=1
    local frontend_image="${GHCR_IMAGE_PREFIX}-frontend:${IMAGE_TAG}"
    local sha=""

    echo -e "${YELLOW}⏳ Waiting for GHCR frontend image to match git HEAD (${LOCAL_GIT_SHA})...${NC}"
    echo -e "${YELLOW}   Polling every ${sleep_secs}s (max ${max_attempts} attempts). Ctrl+C to abort.${NC}"

    while [ "$attempt" -le "$max_attempts" ]; do
        echo -e "${YELLOW}   [${attempt}/${max_attempts}] docker pull ${frontend_image}${NC}"
        if docker pull "$frontend_image" >/dev/null 2>&1; then
            sha="$(image_build_sha_from_tar "$frontend_image" /usr/share/nginx/html/.build_sha)"
            if [ -n "$sha" ] && [ "$sha" = "$LOCAL_GIT_SHA" ]; then
                echo -e "${GREEN}✅ GHCR frontend image matches git HEAD.${NC}"
                return 0
            fi
            echo -e "${YELLOW}   Image BUILD_SHA=${sha:-missing} — still waiting for CI...${NC}"
        else
            echo -e "${YELLOW}   Pull failed (CI may not have published yet). Retrying...${NC}"
        fi
        sleep "$sleep_secs"
        attempt=$((attempt + 1))
    done

    echo -e "${RED}❌ Timed out waiting for GHCR frontend image for ${LOCAL_GIT_SHA}.${NC}"
    echo -e "${RED}   Check GitHub Actions on main finished successfully, then retry.${NC}"
    return 1
}

log_image_metadata() {
    local name="$1"
    local image="${GHCR_IMAGE_PREFIX}-${name}:${IMAGE_TAG}"
    if docker image inspect "$image" >/dev/null 2>&1; then
        docker image inspect "$image" --format "   ${name}: {{.Id}} created={{.Created}}" 2>/dev/null || true
    else
        echo -e "${YELLOW}   ${name}: image not present locally (${image})${NC}"
    fi
}

container_build_sha() {
    local service="$1"
    local path="$2"
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" exec -T "$service" cat "$path" 2>/dev/null | tr -d '\r'
}

verify_service_build_sha() {
    local service="$1"
    local path="$2"
    local label="$3"
    local image_sha
    image_sha="$(container_build_sha "$service" "$path")"

    if [ -z "$image_sha" ]; then
        echo -e "${YELLOW}   ⚠️  ${label}: no .build_sha in running container (image predates build stamp).${NC}"
        return 2
    fi

    echo -e "${GREEN}   ${label} BUILD_SHA=${image_sha}  git HEAD=${LOCAL_GIT_SHA}${NC}"
    if [ "$image_sha" = "$LOCAL_GIT_SHA" ]; then
        return 0
    fi

    echo -e "${RED}   ❌ ${label} image does not match git HEAD on the server.${NC}"
    ghcr_deploy_hint
    return 1
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
LOCAL_GIT_SHA="$(git rev-parse HEAD 2>/dev/null || true)"
if [ -n "$LOCAL_GIT_SHA" ]; then
    echo -e "${YELLOW}📌 git HEAD: ${LOCAL_GIT_SHA}${NC}"
    if [ "$IMAGE_TAG" = "main" ] && [ "$LOCAL_BUILD" != true ] && [ "$SKIP_PULL" != true ]; then
        echo -e "${YELLOW}   Tip: use --wait-for-ci after git pull if the droplet cannot run --build-local (low RAM).${NC}"
    fi
fi
if [ "$LOCAL_BUILD_BACKEND_ONLY" = true ]; then
    echo -e "${RED}⚠️  --build-local-backend updates ONLY the backend container. Frontend/nginx stay on the current GHCR/local images.${NC}"
    echo -e "${RED}   For React/frontend fixes: push to main, wait for CI, then ./scripts/deploy.sh --wait-for-ci${NC}"
fi
if [ "$WAIT_FOR_CI" = true ] && [ "$LOCAL_BUILD" = true ]; then
    echo -e "${RED}❌ --wait-for-ci cannot be combined with --build-local.${NC}"
    exit 1
fi
if [ -n "${NGINX_CONF:-}" ]; then
    echo -e "${YELLOW}🔐 Using nginx config: ${NGINX_CONF}${NC}"
fi

# Only .env.compose for variable substitution (root .env may contain unescaped $ in secrets).
COMPOSE_ENV_ARGS=(--env-file "$COMPOSE_ENV_FILE")
if [ -f ".env" ] && grep -qE '^(DB_PASSWORD|POSTGRES_PASSWORD)=' .env 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Root .env contains DB_PASSWORD/POSTGRES_PASSWORD. Docker Compose still auto-loads .env and may warn about \$ in passwords (e.g. vL8). Keep DB secrets only in acbc_app/.env.${NC}"
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

# Host nginx/apache must not bind :80/:443 — Docker nginx publishes those ports.
echo -e "${YELLOW}🔓 Ensuring host nginx/apache are stopped (Docker nginx needs ports 80/443)...${NC}"
(systemctl stop nginx 2>/dev/null || true)
(systemctl disable nginx 2>/dev/null || true)
(systemctl stop apache2 2>/dev/null || true)
sleep 2

if port_80_in_use && ! port_80_used_by_docker; then
  echo -e "${RED}❌ Port 80 still in use by a non-Docker process.${NC}"
  echo "Inspect with: ss -tlnp | grep ':80'"
  exit 1
fi

# Pull or build images before stopping the stack (avoids downtime if pull/build fails).
if [ "$LOCAL_BUILD" = true ]; then
  if [ ! -f "docker-compose.build.yml" ]; then
    echo -e "${RED}❌ docker-compose.build.yml not found; cannot run local build.${NC}"
    exit 1
  fi

  if [ "$LOCAL_BUILD_BACKEND_ONLY" = true ]; then
    require_ram_for_local_build "$LOCAL_BUILD_BACKEND_MIN_MB" "--build-local-backend"
  else
    require_ram_for_local_build "$LOCAL_BUILD_FULL_MIN_MB" "--build-local (frontend npm build)"
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
    echo -e "${YELLOW}⚠️  Ignoring --no-cache because this deploy pulls prebuilt images. Use --build-local --no-cache for a local rebuild (requires ~3GB+ RAM).${NC}"
  fi

  if [ "$WAIT_FOR_CI" = true ]; then
    if [ -z "$LOCAL_GIT_SHA" ]; then
      echo -e "${RED}❌ Cannot use --wait-for-ci outside a git checkout.${NC}"
      exit 1
    fi
    wait_for_ghcr_frontend_image
  fi

  if [ "$SKIP_PULL" = true ]; then
    echo -e "${YELLOW}⏭️  Skipping image pull (--skip-pull)${NC}"
  else
    echo -e "${YELLOW}📥 Pulling prebuilt images from GHCR (tag: ${IMAGE_TAG})...${NC}"
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" pull
    echo -e "${YELLOW}   Pulled image metadata:${NC}"
    log_image_metadata backend
    log_image_metadata frontend
    log_image_metadata nginx
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

# Collect static files (verbosity 0 hides harmless duplicate-path notices)
echo -e "${YELLOW}📁 Collecting static files...${NC}"
docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" exec -T backend python manage.py collectstatic --noinput --verbosity 0

# Check service health
echo -e "${YELLOW}🏥 Checking service health...${NC}"
sleep 5

# Nginx must publish port 80 on the host
if ! docker port acbc_nginx_prod 80 >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker nginx is not listening on host port 80.${NC}"
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" ps nginx || true
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" logs --tail=40 nginx || true
    echo -e "${RED}   Fix: systemctl stop nginx && docker compose ... up -d${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Nginx published on $(docker port acbc_nginx_prod 80 | head -n 1)${NC}"

# Check backend health
if curl -f http://localhost/health/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend health check passed${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" logs --tail=40 nginx backend
    exit 1
fi

# Verify backend container includes expected application code (GHCR :main can be stale)
echo -e "${YELLOW}🔎 Verifying backend image matches git HEAD...${NC}"
BACKEND_VERIFY=0
if docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" exec -T backend test -f /app/content/views_youtube_migration.py 2>/dev/null; then
    verify_service_build_sha backend /app/.build_sha Backend
    BACKEND_VERIFY=$?
    if [ "$BACKEND_VERIFY" -eq 2 ]; then
        echo -e "${YELLOW}   Backend has no .build_sha; using legacy file presence check only.${NC}"
        BACKEND_VERIFY=0
    fi
else
    echo -e "${RED}❌ Backend container is missing expected application code (stale GHCR image).${NC}"
    echo -e "${RED}   Running container image: $(docker inspect acbc_backend_prod --format '{{.Config.Image}}' 2>/dev/null || echo unknown)${NC}"
    echo -e "${RED}   Fix: ./scripts/deploy.sh --build-local-backend   (backend only, ~few min)${NC}"
    echo -e "${RED}   Or set IMAGE_TAG to the commit SHA published by GitHub Actions, then redeploy.${NC}"
    BACKEND_VERIFY=1
fi

if [ "$BACKEND_VERIFY" -eq 1 ] && [ "$ALLOW_STALE_IMAGES" != true ]; then
    exit 1
fi
if [ "$BACKEND_VERIFY" -eq 1 ] && [ "$ALLOW_STALE_IMAGES" = true ]; then
    echo -e "${YELLOW}   Continuing because --allow-stale-images was set.${NC}"
fi

# Check frontend health
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend health check passed${NC}"
else
    echo -e "${RED}❌ Frontend health check failed${NC}"
    docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" logs frontend
    exit 1
fi

# Verify frontend bundle matches git HEAD (critical for React deploys)
echo -e "${YELLOW}🔎 Verifying frontend image matches git HEAD...${NC}"
FRONTEND_VERIFY=0
verify_service_build_sha frontend /usr/share/nginx/html/.build_sha Frontend
FRONTEND_VERIFY=$?
if [ "$FRONTEND_VERIFY" -eq 2 ]; then
    CONTAINER_BUNDLE="$(docker compose "${COMPOSE_ENV_ARGS[@]}" "${PROD_COMPOSE_FILES[@]}" exec -T frontend sh -c 'grep -oE "assets/index-[^.]+\.js" /usr/share/nginx/html/index.html | head -n1' 2>/dev/null | tr -d '\r')"
    SERVED_BUNDLE="$(curl -sf http://localhost/ | grep -oE 'assets/index-[^.]+\.js' | head -n1 || true)"
    echo -e "${YELLOW}   Frontend .build_sha missing. Bundle in container: ${CONTAINER_BUNDLE:-unknown}${NC}"
    echo -e "${YELLOW}   Bundle served via nginx: ${SERVED_BUNDLE:-unknown}${NC}"
    if [ -n "$LOCAL_GIT_SHA" ] && git cat-file -e "${LOCAL_GIT_SHA}:frontend/src/events/EventDetail.jsx" 2>/dev/null; then
        echo -e "${RED}   ❌ Cannot verify frontend version. GHCR image likely predates build stamping.${NC}"
        ghcr_deploy_hint
        FRONTEND_VERIFY=1
    else
        FRONTEND_VERIFY=0
    fi
fi

if [ "$FRONTEND_VERIFY" -eq 1 ] && [ "$ALLOW_STALE_IMAGES" != true ]; then
    exit 1
fi
if [ "$FRONTEND_VERIFY" -eq 1 ] && [ "$ALLOW_STALE_IMAGES" = true ]; then
    echo -e "${YELLOW}   Continuing because --allow-stale-images was set.${NC}"
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
