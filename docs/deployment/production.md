# Production Deployment Guide

This guide covers deploying the Sophia.AI Academia Blockchain platform to a production environment.

## Prerequisites

- Server with Docker and Docker Compose installed
- Domain name configured
- SSL certificate (Let's Encrypt recommended)
- AWS account (if using S3 for media storage)
- Google OAuth credentials configured

## Pre-Deployment Checklist

- [ ] Environment variables configured
- [ ] Database backups configured
- [ ] SSL certificates obtained
- [ ] Domain DNS configured
- [ ] Google OAuth redirect URIs updated
- [ ] AWS credentials configured (if using S3)
- [ ] Monitoring and logging set up
- [ ] Security settings reviewed

## Step 1: Server Setup

### Install Docker and Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH
sudo ufw enable
```

## Step 2: Clone and Configure

```bash
# Clone repository
git clone <repository-url>
cd Sophia.AI-Academia-Blockchain

# Create production environment files
cp acbc_app/.env.example acbc_app/.env
cp frontend/.env.example frontend/.env
```

### Configure Backend Environment

Edit `acbc_app/.env`:

```env
# Generate a secure secret key
ACADEMIA_BLOCKCHAIN_SKEY=<generate-secure-key>
ENVIRONMENT=PRODUCTION
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Database
DB_NAME=academiablockchain_prod
DB_USER=db_user
DB_PASSWORD=<secure-password>
DB_HOST=postgres
DB_PORT=5432

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_SECRET_KEY=your-secret-key

# AWS S3 (if using)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_STORAGE_BUCKET_NAME=academiablockchain
AWS_S3_REGION_NAME=us-west-2

# Monitoring
SENTRY_DSN=your-sentry-dsn
```

### Configure Frontend Environment

Edit `frontend/.env`:

```env
VITE_API_URL=https://api.yourdomain.com/api
VITE_GOOGLE_OAUTH_CLIENT_ID=your-client-id
```

## Step 3: Database Setup

### Create Production Database

```bash
# Access PostgreSQL container
docker-compose exec postgres bash

# Connect to PostgreSQL
psql -U postgres

# Create production database
CREATE DATABASE academiablockchain_prod;
CREATE USER db_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE academiablockchain_prod TO db_user;
\q
exit
```

### Run Migrations

```bash
docker-compose exec backend python manage.py migrate
```

## Step 4: Static Files and Media

### Collect Static Files

```bash
docker-compose exec backend python manage.py collectstatic --noinput
```

### Configure Media Storage

**Option 1: Local Storage** (default)
- Files stored in `acbc_app/media/`
- Ensure directory has proper permissions

**Option 2: AWS S3** (recommended for production)
- Configure AWS credentials in `.env`
- Update `settings.py` to use S3 storage
- See [AWS S3 Configuration](aws-s3.md)

## Step 5: Reverse Proxy Setup (Nginx)

### Install Nginx

```bash
sudo apt install nginx
```

### Configure Nginx

Create `/etc/nginx/sites-available/academiablockchain`:

```nginx
# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/academiablockchain /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 6: SSL Certificate (Let's Encrypt)

### Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx
```

### Obtain Certificate

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com
```

Certbot will automatically configure Nginx for HTTPS.

## Step 7: Start Services

```bash
# Build and start
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## Step 8: Create Admin User

```bash
docker-compose exec backend python manage.py create_admin
```

## Step 9: Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Update OAuth 2.0 Client authorized redirect URIs:
   - `https://yourdomain.com`
   - `https://api.yourdomain.com/accounts/google/login/callback/`
3. Update environment variables with new client ID/secret if needed

## Step 10: Monitoring and Logging

### Set Up Log Rotation

Configure log rotation in `/etc/logrotate.d/academiablockchain`:

```
/path/to/acbc_app/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

### Set Up Monitoring

- Configure Sentry for error tracking
- Set up uptime monitoring
- Configure database backups

## Maintenance

### Regular Tasks

```bash
# Update code
git pull origin main
docker-compose up -d --build

# Run migrations
docker-compose exec backend python manage.py migrate

# Collect static files
docker-compose exec backend python manage.py collectstatic --noinput

# Backup database
docker-compose exec postgres pg_dump -U postgres academiablockchain_prod > backup.sql
```

### Database Backups

Set up automated backups:

```bash
# Create backup script
cat > /usr/local/bin/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T postgres pg_dump -U postgres academiablockchain_prod | gzip > $BACKUP_DIR/backup_$DATE.sql.gz
# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-db.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /usr/local/bin/backup-db.sh" | crontab -
```

## Troubleshooting

### Check Service Status

```bash
docker-compose ps
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres
```

### Common Issues

1. **502 Bad Gateway**: Check if services are running
2. **Database Connection Error**: Verify database credentials
3. **Static Files Not Loading**: Run `collectstatic`
4. **SSL Certificate Issues**: Renew with `sudo certbot renew`

## Security Checklist

- [ ] `DEBUG=False` in production
- [ ] Strong `SECRET_KEY` set
- [ ] `ALLOWED_HOSTS` configured correctly
- [ ] HTTPS enabled
- [ ] Database credentials secure
- [ ] OAuth credentials secure
- [ ] AWS credentials have minimal permissions
- [ ] Firewall configured
- [ ] Regular security updates applied

## Related Documentation

- [Environment Variables](environment-variables.md)
- [Docker Configuration](docker.md)
- [Local Development](local-development.md)
- [Security Guide](../security/README.md)

