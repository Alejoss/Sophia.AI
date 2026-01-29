# Production Deployment Quick Start

## Quick Checklist

### Before Deployment

- [ ] Set `ENVIRONMENT=PRODUCTION` in `acbc_app/.env`
- [ ] Set `DEBUG=False` in `acbc_app/.env`
- [ ] Set `ALLOWED_HOSTS` to your domain(s) in `acbc_app/.env`
- [ ] Generate and set secure `ACADEMIA_BLOCKCHAIN_SKEY`
- [ ] Configure database credentials
- [ ] Set up Google OAuth credentials (if using)
- [ ] Configure frontend `.env` with production API URL

### Deployment Steps

0. **Connect to the server (Digital Ocean droplet):**
   ```bash
   ssh root@YOUR_DROPLET_IP
   # Example: ssh root@159.65.69.165
   ```
   Then go to the app directory, e.g. `cd /opt/acbc-app`.

1. **Build and deploy:**
   ```bash
   ./scripts/deploy.sh
   ```

2. **Set up SSL (after DNS is configured):**
   ```bash
   ./scripts/setup-ssl.sh yourdomain.com
   ```

3. **Create admin user:**
   ```bash
   docker-compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
   ```

4. **Set up automated backups:**
   ```bash
   # Add to crontab
   (crontab -l 2>/dev/null; echo "0 2 * * * cd $(pwd) && ./scripts/backup-db.sh") | crontab -
   ```

### Common Commands

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Stop services
docker-compose -f docker-compose.prod.yml down

# Backup database
./scripts/backup-db.sh

# Update application
git pull && ./scripts/deploy.sh
```

### Health Checks

- Backend: `http://yourdomain.com/health/`
- Frontend: `http://yourdomain.com/health`

### Important Files

- Production compose: `docker-compose.prod.yml`
- Backend env: `acbc_app/.env`
- Frontend env: `frontend/.env`
- Nginx config: `nginx/nginx.conf`

### Troubleshooting

**Services won't start:**
```bash
docker-compose -f docker-compose.prod.yml logs
docker-compose -f docker-compose.prod.yml ps
```

**Database issues:**
```bash
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d academiablockchain_prod
```

**Static files not loading:**
```bash
docker-compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
```

For detailed instructions, see [Digital Ocean Deployment Guide](docs/deployment/digital-ocean.md).
