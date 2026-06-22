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

echo "Stopping nginx briefly for certificate issuance..."
docker compose -f docker-compose.prod.yml stop nginx 2>/dev/null || true

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
OUTPUT="$PROJECT_ROOT/nginx/nginx-ssl.conf"
if [ ! -f "$TEMPLATE" ]; then
    echo "Error: template not found: $TEMPLATE"
    exit 1
fi
echo "Writing $OUTPUT (gitignored – repo unchanged)..."
sed -e "s/SSL_DOMAIN_PLACEHOLDER/$CERT_NAME/g" \
    -e "s/CANONICAL_HOST_PLACEHOLDER/$CANONICAL_HOST/g" \
    -e "s/APEX_HOST_PLACEHOLDER/$APEX_HOST/g" \
    "$TEMPLATE" > "$OUTPUT"

echo "Starting nginx with SSL config..."
export NGINX_CONF=./nginx/nginx-ssl.conf
docker compose -f docker-compose.prod.yml up -d nginx

echo "Setting up certificate auto-renewal (crontab)..."
CRON_CMD="0 3 * * * (docker compose -f $PROJECT_ROOT/docker-compose.prod.yml stop nginx 2>/dev/null; sudo certbot renew --quiet --standalone; cd $PROJECT_ROOT && NGINX_CONF=./nginx/nginx-ssl.conf docker compose -f docker-compose.prod.yml up -d nginx)"
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
