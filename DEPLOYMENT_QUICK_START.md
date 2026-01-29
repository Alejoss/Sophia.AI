# Production Deployment Quick Start

## Quick Checklist

### Before Deployment

- [ ] Set `ENVIRONMENT=PRODUCTION` in `acbc_app/.env`
- [ ] Set `DEBUG=False` in `acbc_app/.env`
- [ ] Set `ALLOWED_HOSTS` to your domain(s) in `acbc_app/.env`
- [ ] Generate and set secure `ACADEMIA_BLOCKCHAIN_SKEY`
- [ ] Configure database credentials in `acbc_app/.env`:
  - Set `POSTGRES_DB` (or `DB_NAME`), `POSTGRES_USER` (or `DB_USER`), `POSTGRES_PASSWORD` (or `DB_PASSWORD`)
- [ ] **Optional but recommended**: Create `.env` in project root (see `.env.example`) with `DB_NAME`, `DB_USER`, `DB_PASSWORD` for Docker Compose variable substitution
- [ ] Set up Google OAuth credentials (if using)
- [ ] Configure frontend `.env` with production API URL

### Deployment Steps

0. **Connect to the server (Digital Ocean droplet):**
   ```bash
   ssh root@YOUR_DROPLET_IP
   # Example: ssh root@159.65.69.165
   ```
   Then go to the app directory, e.g. `cd /opt/acbc-app`.

1. **Build and deploy (recommended):**
   ```bash
   ./scripts/deploy.sh
   ```

   **Or build and run manually** (from project root, e.g. `/opt/acbc-app`):
   ```bash
   # Option 1: Export variables for Docker Compose substitution
   export DB_NAME=$(grep "^DB_NAME=" acbc_app/.env | cut -d= -f2)
   export DB_USER=$(grep "^DB_USER=" acbc_app/.env | cut -d= -f2)
   export DB_PASSWORD=$(grep "^DB_PASSWORD=" acbc_app/.env | cut -d= -f2)
   
   # Option 2: Create root .env file (copy from .env.example and fill values)
   # cp .env.example .env
   # nano .env  # Edit with your values
   
   docker compose -f docker-compose.prod.yml down
   docker compose -f docker-compose.prod.yml build --no-cache
   docker compose -f docker-compose.prod.yml up -d
   sleep 10
   docker compose -f docker-compose.prod.yml exec backend python manage.py migrate --noinput
   docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
   ```

2. **Set up SSL (after DNS is configured):**
   ```bash
   ./scripts/setup-ssl.sh yourdomain.com
   ```

3. **Create admin user:**
   ```bash
   docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
   ```

4. **Set up automated backups:**
   ```bash
   # Add to crontab
   (crontab -l 2>/dev/null; echo "0 2 * * * cd $(pwd) && ./scripts/backup-db.sh") | crontab -
   ```

### Common Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart services
docker compose -f docker-compose.prod.yml restart

# Stop services
docker compose -f docker-compose.prod.yml down

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
- Backend env: `acbc_app/.env` (main configuration)
- Root `.env`: Optional, for Docker Compose variable substitution (see `.env.example`)
- Frontend env: `frontend/.env`
- Nginx config: `nginx/nginx.conf`

**Note**: Docker Compose reads variables from `acbc_app/.env` via `env_file` for containers, but variable substitution in `docker-compose.prod.yml` (like `${DB_NAME}`) requires variables in shell environment or root `.env`. Best practice: ensure `acbc_app/.env` has `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` set, or create root `.env` with `DB_NAME`, `DB_USER`, `DB_PASSWORD`.

### Troubleshooting

**Services won't start:**
```bash
docker compose -f docker-compose.prod.yml logs
docker compose -f docker-compose.prod.yml ps
```

**Database issues:**
```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d academiablockchain_prod
```

**Static files not loading:**
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
```

For detailed instructions, see [Digital Ocean Deployment Guide](docs/deployment/digital-ocean.md).
