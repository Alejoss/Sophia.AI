# Digital Ocean Deployment Guide

This guide provides step-by-step instructions for deploying the Sophia.AI Academia Blockchain platform to Digital Ocean.

## Prerequisites

- Digital Ocean account
- Domain name configured (optional but recommended)
- SSH access to your Digital Ocean droplet
- Basic knowledge of Linux command line

## Step 1: Create Digital Ocean Droplet

1. Log in to Digital Ocean
2. Create a new Droplet:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Minimum 2GB RAM, 1 vCPU (4GB+ recommended for production)
   - **Region**: Choose closest to your users
   - **Authentication**: SSH keys (recommended) or password
3. Note your droplet's IP address

## Step 2: Initial Server Setup

### Connect to your droplet

```bash
ssh root@your-droplet-ip
```

### Update system

```bash
apt update && apt upgrade -y
```

### Create non-root user (optional but recommended)

```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

### Install Docker and Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group (if using non-root user)
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

### Configure Firewall

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

## Step 3: Clone Repository

```bash
cd /opt
sudo git clone <your-repository-url> sophia-ai
sudo chown -R $USER:$USER sophia-ai
cd sophia-ai
```

## Step 4: Configure Environment Variables

### Backend Configuration

Create production `.env` file:

```bash
cp acbc_app/.env.example acbc_app/.env
nano acbc_app/.env
```

**Required variables:**

```env
# Generate a secure secret key:
# python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
ACADEMIA_BLOCKCHAIN_SKEY=your-generated-secret-key-here
ENVIRONMENT=PRODUCTION
DEBUG=False

# REQUIRED: Set your domain(s)
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,api.yourdomain.com

# Database
DB_NAME=academiablockchain_prod
DB_USER=postgres
DB_PASSWORD=your-secure-database-password
DB_HOST=postgres
DB_PORT=5432

POSTGRES_DB=academiablockchain_prod
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-database-password

# Google OAuth (if using)
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_SECRET_KEY=your-secret-key
```

### Frontend Configuration

```bash
nano frontend/.env
```

```env
VITE_API_URL=https://api.yourdomain.com/api
VITE_GOOGLE_OAUTH_CLIENT_ID=your-client-id
```

## Step 5: Deploy Application

### Make scripts executable

```bash
chmod +x scripts/*.sh
```

### Run deployment script

```bash
./scripts/deploy.sh
```

This will:
- Validate configuration
- Build Docker images
- Start services
- Run migrations
- Collect static files
- Perform health checks

## Step 6: Set Up SSL (Let's Encrypt)

### Configure DNS

Point your domain to your droplet's IP:
- A record: `yourdomain.com` → droplet IP
- A record: `www.yourdomain.com` → droplet IP
- A record: `api.yourdomain.com` → droplet IP

Wait for DNS propagation (can take up to 48 hours, usually much faster).

### Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Generate SSL Certificate

```bash
# Stop nginx temporarily
docker-compose -f docker-compose.prod.yml stop nginx

# Generate certificate
sudo certbot certonly --standalone \
    -d yourdomain.com \
    -d www.yourdomain.com \
    -d api.yourdomain.com \
    --email your-email@example.com \
    --agree-tos \
    --non-interactive
```

### Update Nginx Configuration

Edit `nginx/nginx.conf` and replace `yourdomain.com` with your actual domain:

```bash
sed -i 's/yourdomain.com/your-actual-domain.com/g' nginx/nginx.conf
```

### Copy Certificates to Docker Volume

```bash
# Create volume directories
sudo mkdir -p /var/lib/docker/volumes/sophia-ai-academia-blockchain_certbot_certs/_data/live/yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem \
    /var/lib/docker/volumes/sophia-ai-academia-blockchain_certbot_certs/_data/live/yourdomain.com/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem \
    /var/lib/docker/volumes/sophia-ai-academia-blockchain_certbot_certs/_data/live/yourdomain.com/
```

### Restart Services

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Set Up Auto-Renewal

```bash
# Add to crontab
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --deploy-hook 'cd /opt/sophia-ai && docker-compose -f docker-compose.prod.yml restart nginx'") | crontab -
```

## Step 7: Create Admin User

```bash
docker-compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

## Step 8: Set Up Automated Backups

### Create backup directory

```bash
mkdir -p /opt/backups
```

### Add to crontab

```bash
# Daily backup at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * cd /opt/sophia-ai && ./scripts/backup-db.sh") | crontab -
```

## Step 9: Configure Monitoring (Optional)

### Set up uptime monitoring

- Use Digital Ocean monitoring
- Or use external service like UptimeRobot, Pingdom, etc.

### Configure error tracking

If using Sentry, add to `acbc_app/.env`:

```env
SENTRY_DSN=your-sentry-dsn
```

## Maintenance

### Update Application

```bash
cd /opt/sophia-ai
git pull origin main
./scripts/deploy.sh
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### Backup Database

```bash
./scripts/backup-db.sh
```

### Restore Database

```bash
./scripts/restore-db.sh backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check container status
docker-compose -f docker-compose.prod.yml ps

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

### Database connection errors

- Verify database credentials in `.env`
- Check PostgreSQL container is running: `docker-compose -f docker-compose.prod.yml ps postgres`
- Check logs: `docker-compose -f docker-compose.prod.yml logs postgres`

### SSL certificate issues

- Verify DNS is pointing to correct IP
- Check certificate expiration: `sudo certbot certificates`
- Renew manually: `sudo certbot renew`

### Static files not loading

```bash
# Recollect static files
docker-compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
```

## Security Checklist

- [ ] `DEBUG=False` in production
- [ ] Strong `SECRET_KEY` set
- [ ] `ALLOWED_HOSTS` configured correctly
- [ ] HTTPS enabled
- [ ] Database credentials secure
- [ ] OAuth credentials secure
- [ ] Firewall configured (only 22, 80, 443 open)
- [ ] Regular security updates applied
- [ ] Automated backups configured
- [ ] Monitoring set up

## Performance Optimization

### Database

Consider using Digital Ocean Managed PostgreSQL for better performance and reliability.

### Caching

Add Redis for caching:

```yaml
# Add to docker-compose.prod.yml
redis:
  image: redis:alpine
  networks:
    - app_network
```

### CDN

Consider using a CDN for static files (Cloudflare, AWS CloudFront, etc.).

## Related Documentation

- [Production Deployment](production.md)
- [Docker Configuration](docker.md)
- [Environment Variables](environment-variables.md)
- [Security Guide](../security/README.md)
