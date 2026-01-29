#!/bin/bash

# SSL Certificate Setup Script for Let's Encrypt
# This script sets up SSL certificates using Certbot

set -e

echo "🔒 Setting up SSL certificates with Let's Encrypt..."

# Check if domain is provided
if [ -z "$1" ]; then
    echo "Usage: ./setup-ssl.sh <your-domain.com>"
    echo "Example: ./setup-ssl.sh sophia-ai.algobeat.com"
    exit 1
fi

DOMAIN=$1
EMAIL=${2:-"admin@${DOMAIN}"}

echo "Domain: $DOMAIN"
echo "Email: $EMAIL"

# Install certbot if not already installed
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
fi

# Stop nginx temporarily for initial certificate generation
echo "Temporarily stopping nginx..."
docker-compose -f docker-compose.prod.yml stop nginx || true

# Generate certificate
echo "Generating SSL certificate..."
sudo certbot certonly --standalone \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive

# Update nginx configuration with domain
sed -i "s/yourdomain.com/$DOMAIN/g" nginx/nginx.conf

# Copy certificates to docker volume location
echo "Setting up certificate volumes..."
sudo mkdir -p /var/lib/docker/volumes/sophia-ai-academia-blockchain_certbot_certs/_data/live/$DOMAIN
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /var/lib/docker/volumes/sophia-ai-academia-blockchain_certbot_certs/_data/live/$DOMAIN/ 2>/dev/null || true
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /var/lib/docker/volumes/sophia-ai-academia-blockchain_certbot_certs/_data/live/$DOMAIN/ 2>/dev/null || true

# Update nginx config path in docker-compose
echo "Updating nginx configuration..."
sed -i "s|/etc/letsencrypt/live/yourdomain.com|/etc/letsencrypt/live/$DOMAIN|g" nginx/nginx.conf

# Restart nginx
echo "Starting nginx..."
docker-compose -f docker-compose.prod.yml up -d nginx

# Set up auto-renewal
echo "Setting up certificate auto-renewal..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --deploy-hook 'docker-compose -f $(pwd)/docker-compose.prod.yml restart nginx'") | crontab -

echo "✅ SSL certificate setup complete!"
echo ""
echo "Certificate will auto-renew. To manually renew:"
echo "  sudo certbot renew"
echo ""
echo "To test renewal:"
echo "  sudo certbot renew --dry-run"
