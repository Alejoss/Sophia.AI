#!/bin/bash
# Script to setup Nginx as reverse proxy for Academia Blockchain
# Run this script on the server after pulling the repository

set -e

echo "=========================================="
echo "Nginx Setup for Academia Blockchain"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Check if port 80 is in use by Docker container
if command -v docker &> /dev/null; then
    if docker ps --format '{{.Ports}}' | grep -q ':80->'; then
        echo "⚠️  Warning: Port 80 is in use by a Docker container"
        echo "   The frontend container needs to be restarted to use port 8080"
        echo "   After this script completes, run: docker compose up -d frontend"
    fi
fi

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    apt update
    apt install nginx -y
    echo "✅ Nginx installed"
else
    echo "✅ Nginx is already installed"
fi

# Get the project directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
NGINX_CONF="$PROJECT_DIR/nginx/nginx-server.conf"

# Check if nginx config file exists
if [ ! -f "$NGINX_CONF" ]; then
    echo "❌ Error: Nginx config file not found at $NGINX_CONF"
    exit 1
fi

# Copy nginx config to sites-available
echo "Copying Nginx configuration..."
cp "$NGINX_CONF" /etc/nginx/sites-available/acbc-app

# Create symlink to sites-enabled
echo "Enabling site..."
if [ -L /etc/nginx/sites-enabled/acbc-app ]; then
    echo "⚠️  Site already enabled, removing old symlink..."
    rm /etc/nginx/sites-enabled/acbc-app
fi
ln -s /etc/nginx/sites-available/acbc-app /etc/nginx/sites-enabled/acbc-app

# Remove default nginx site (optional)
if [ -L /etc/nginx/sites-enabled/default ]; then
    echo "Removing default Nginx site..."
    rm /etc/nginx/sites-enabled/default
fi

# Test Nginx configuration
echo "Testing Nginx configuration..."
if nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration test failed!"
    exit 1
fi

# Start or reload Nginx
echo "Starting/Reloading Nginx..."
if systemctl is-active --quiet nginx; then
    systemctl reload nginx
    echo "✅ Nginx reloaded"
else
    systemctl start nginx
    systemctl enable nginx
    echo "✅ Nginx started and enabled"
fi

# Check Nginx status
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
else
    echo "⚠️  Warning: Nginx might not be running. Check with: systemctl status nginx"
fi

echo ""
echo "=========================================="
echo "✅ Nginx setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Stop frontend if running on port 80: docker compose stop frontend"
echo "2. Update docker-compose.yml (frontend port changed to 8080)"
echo "3. Restart frontend: docker compose up -d frontend"
echo "4. Update VITE_API_URL in .env to: http://$(hostname -I | awk '{print $1}')/api"
echo "5. Rebuild frontend: docker compose build frontend && docker compose up -d frontend"
echo ""
echo "To verify:"
echo "  curl http://$(hostname -I | awk '{print $1}')/api/health/"
echo ""
