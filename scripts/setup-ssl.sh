#!/bin/bash

# SSL setup with Let's Encrypt (free certificates from https://letsencrypt.org).
# Uses certbot standalone (nginx is stopped briefly). Writes only to nginx/nginx-ssl.conf
# (gitignored) so the repo is not modified. After this, set ALLOWED_HOSTS and rebuild once.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🔒 Setting up SSL with Let's Encrypt..."

if [ -z "$1" ]; then
    echo "Usage: ./scripts/setup-ssl.sh <your-domain.com> [email]"
    echo "Example: ./scripts/setup-ssl.sh academiablockchain.com admin@academiablockchain.com"
    exit 1
fi

DOMAIN=$1
DOT_COUNT=$(awk -F'.' '{print NF-1}' <<< "$DOMAIN")

# Canonical host is always www; apex redirects there (see nginx-ssl.conf.template).
if [[ "$DOMAIN" == www.* ]]; then
    CANONICAL_HOST="$DOMAIN"
    APEX_HOST="${DOMAIN#www.}"
else
    APEX_HOST="$DOMAIN"
    CANONICAL_HOST="www.$DOMAIN"
fi

EMAIL=${2:-"admin@${APEX_HOST}"}
# Let's Encrypt stores certs under the cert name (existing install uses apex).
CERT_NAME="$APEX_HOST"

# Build certificate SANs:
# - If apex domain is provided (example.com), include www.example.com automatically.
# - If www domain is provided, include the apex domain too.
DOMAINS=("$DOMAIN")
if [[ "$DOMAIN" == www.* ]]; then
    APEX_DOMAIN="${DOMAIN#www.}"
    DOMAINS+=("$APEX_DOMAIN")
elif [ "$DOT_COUNT" -eq 1 ]; then
    DOMAINS+=("www.$DOMAIN")
fi

# Deduplicate in case values overlap
UNIQUE_DOMAINS=()
for d in "${DOMAINS[@]}"; do
    if [[ ! " ${UNIQUE_DOMAINS[*]} " =~ " $d " ]]; then
        UNIQUE_DOMAINS+=("$d")
    fi
done

echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo "Certificate domains (SAN): ${UNIQUE_DOMAINS[*]}"
echo "Certificate: Let's Encrypt (free, from https://letsencrypt.org)"

if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot
fi

NGINX_CONTAINER="acbc_nginx_prod"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
COMPOSE_ENV_FILE="$PROJECT_ROOT/.env.compose"
OUTPUT="$PROJECT_ROOT/nginx/nginx-ssl.conf"
HOST_NGINX_STOPPED=0
NGINX_WAS_RUNNING=0

compose() {
    if [ -f "$COMPOSE_ENV_FILE" ]; then
        docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" "$@"
    else
        docker compose -f "$COMPOSE_FILE" "$@"
    fi
}

port_80_in_use() {
    ss -tln 2>/dev/null | grep -q ':80 ' || \
        netstat -tln 2>/dev/null | grep -q ':80 '
}

show_port_80_processes() {
    echo "Processes listening on port 80:"
    if command -v ss &>/dev/null; then
        sudo ss -tlnp | grep ':80 ' || true
    elif command -v netstat &>/dev/null; then
        sudo netstat -tlnp | grep ':80 ' || true
    fi
    docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' 2>/dev/null | grep -E ':80|NAMES' || true
}

stop_services_on_port_80() {
    echo "Stopping nginx briefly for certificate issuance..."

    if docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER"; then
        NGINX_WAS_RUNNING=1
        docker stop "$NGINX_CONTAINER"
    fi

    if systemctl is-active --quiet nginx 2>/dev/null; then
        echo "Stopping host nginx (systemd)..."
        sudo systemctl stop nginx
        HOST_NGINX_STOPPED=1
    fi

    local waited=0
    while port_80_in_use; do
        waited=$((waited + 1))
        if [ "$waited" -ge 20 ]; then
            echo "❌ Port 80 is still in use. Certbot standalone cannot run."
            show_port_80_processes
            echo ""
            echo "Try manually:"
            echo "  docker stop $NGINX_CONTAINER"
            echo "  sudo systemctl stop nginx"
            echo "  sudo ss -tlnp | grep ':80'"
            return 1
        fi
        sleep 1
    done
    echo "Port 80 is free."
}

start_nginx() {
    export NGINX_CONF=./nginx/nginx-ssl.conf
    if [ -f "$OUTPUT" ]; then
        compose up -d nginx
    elif [ "$NGINX_WAS_RUNNING" = "1" ]; then
        docker start "$NGINX_CONTAINER" 2>/dev/null || true
    fi
    if [ "$HOST_NGINX_STOPPED" = "1" ]; then
        sudo systemctl start nginx 2>/dev/null || true
    fi
}

cleanup_on_exit() {
    local exit_code=$?
    if [ "$exit_code" -ne 0 ] && [ "$NGINX_WAS_RUNNING" = "1" ]; then
        echo "Restoring nginx after error (exit $exit_code)..."
        start_nginx
    fi
}
trap cleanup_on_exit EXIT

stop_services_on_port_80

echo "Obtaining certificate (certbot standalone)..."
CERTBOT_DOMAIN_ARGS=()
for d in "${UNIQUE_DOMAINS[@]}"; do
    CERTBOT_DOMAIN_ARGS+=("-d" "$d")
done

sudo certbot certonly --standalone \
    "${CERTBOT_DOMAIN_ARGS[@]}" \
    --cert-name "$CERT_NAME" \
    --expand \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive

# Generate nginx SSL config into a gitignored file (never overwrite nginx.conf)
TEMPLATE="$PROJECT_ROOT/nginx/nginx-ssl.conf.template"
if [ ! -f "$TEMPLATE" ]; then
    echo "Error: template not found: $TEMPLATE"
    exit 1
fi
echo "Writing $OUTPUT (gitignored – repo unchanged)..."
sed -e "s/SSL_DOMAIN_PLACEHOLDER/$CERT_NAME/g" \
    -e "s/CANONICAL_HOST_PLACEHOLDER/$CANONICAL_HOST/g" \
    -e "s/APEX_HOST_PLACEHOLDER/$APEX_HOST/g" \
    "$TEMPLATE" > "$OUTPUT"

trap - EXIT
echo "Starting nginx with SSL config..."
start_nginx

echo "Setting up certificate auto-renewal (crontab)..."
CRON_CMD="0 3 * * * (docker stop $NGINX_CONTAINER 2>/dev/null; sudo systemctl stop nginx 2>/dev/null; sudo certbot renew --quiet --standalone; cd $PROJECT_ROOT && NGINX_CONF=./nginx/nginx-ssl.conf docker compose --env-file $PROJECT_ROOT/.env.compose -f $PROJECT_ROOT/docker-compose.prod.yml up -d nginx 2>/dev/null || docker start $NGINX_CONTAINER 2>/dev/null)"
if ! (crontab -l 2>/dev/null | grep -q "certbot renew"); then
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "Added certbot renewal to crontab."
fi

echo "✅ SSL setup complete."
echo "   Canonical URL: https://$CANONICAL_HOST (apex $APEX_HOST redirects with 301)"
echo "   Certificates: /etc/letsencrypt/live/$CERT_NAME/ (on host)"
echo "   Nginx config: $OUTPUT (gitignored – not in repo)"
echo "   Next: set ALLOWED_HOSTS=$APEX_HOST,$CANONICAL_HOST in acbc_app/.env"
echo "         set FRONTEND_PUBLIC_URL=https://$CANONICAL_HOST"
echo "         then run ./scripts/deploy.sh once."
