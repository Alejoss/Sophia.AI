#!/bin/bash
# Health check script for production stack (nginx, backend, frontend).
# Run from project root: ./scripts/health-check.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-.env.compose}"
COMPOSE_FILE="docker-compose.prod.yml"

# Run from project root (where docker-compose.prod.yml is)
if [ ! -f "docker-compose.prod.yml" ]; then
  echo -e "${RED}Run from project root: cd /opt/acbc-app && ./scripts/health-check.sh${NC}"
  exit 1
fi

echo "🏥 Health check (env: $COMPOSE_ENV_FILE, compose: $COMPOSE_FILE)"
echo ""

FAILED=0

# 1. Container status
if [ -f "$COMPOSE_ENV_FILE" ]; then
  echo -e "${YELLOW}Containers:${NC}"
  docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" ps 2>/dev/null || true
  echo ""
fi

# 2. Backend (via nginx)
if curl -sf http://localhost/health/ > /dev/null; then
  echo -e "${GREEN}✅ Backend (/health/)${NC}"
else
  echo -e "${RED}❌ Backend (/health/)${NC}"
  FAILED=1
fi

# 3. Frontend (via nginx)
if curl -sf http://localhost/health > /dev/null; then
  echo -e "${GREEN}✅ Frontend (/health)${NC}"
else
  echo -e "${RED}❌ Frontend (/health)${NC}"
  FAILED=1
fi

# 4. Optional: backend JSON body
if command -v curl >/dev/null 2>&1; then
  BODY=$(curl -sf http://localhost/health/ 2>/dev/null || true)
  if [ -n "$BODY" ]; then
    echo "   Backend response: $BODY"
  fi
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}All health checks passed.${NC}"
  exit 0
else
  echo -e "${RED}Some health checks failed.${NC}"
  echo "Tip: docker compose --env-file $COMPOSE_ENV_FILE -f $COMPOSE_FILE logs -f"
  exit 1
fi
