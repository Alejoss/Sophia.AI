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
    echo "Example: ./scripts/setup-ssl.sh academia.example.com admin@example.com"
    exit 1
fi

DOMAIN=$1
EMAIL=${2:-"admin@${DOMAIN}"}

echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo "Certificate: Let's Encrypt (free, from https://letsencrypt.org)"

if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot
fi

echo "Stopping nginx briefly for certificate issuance..."
docker compose -f docker-compose.prod.yml stop nginx 2>/dev/null || true

echo "Obtaining certificate (certbot standalone)..."
sudo certbot certonly --standalone \
    -d "$DOMAIN" \
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
sed "s/SSL_DOMAIN_PLACEHOLDER/$DOMAIN/g" "$TEMPLATE" > "$OUTPUT"

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
echo "   Certificates: /etc/letsencrypt/live/$DOMAIN/ (on host)"
echo "   Nginx config: $OUTPUT (gitignored – not in repo)"
echo "   Next: set ALLOWED_HOSTS in acbc_app/.env, then run ./scripts/deploy.sh once."
