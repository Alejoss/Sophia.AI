# Production Deployment Quick Start

## Quick Checklist

### Before Deployment

- [ ] Set `ENVIRONMENT=PRODUCTION` in `acbc_app/.env`
- [ ] Set `DEBUG=False` in `acbc_app/.env`
- [ ] Set `ALLOWED_HOSTS` to your domain(s) in `acbc_app/.env`
- [ ] Generate and set secure `ACADEMIA_BLOCKCHAIN_SKEY`
- [ ] Configure database credentials in `acbc_app/.env`:
  - Set `POSTGRES_DB` (or `DB_NAME`), `POSTGRES_USER` (or `DB_USER`), `POSTGRES_PASSWORD` (or `DB_PASSWORD`)
  - **Recommended**: Use passwords without special characters that cause issues (`$`, `!`, `%`, `` ` ``). Safe characters: letters, numbers, `-`, `_`, `.`, `@`, `#`
- [ ] Set up Google OAuth credentials (if using)
- [ ] Configure frontend `.env` with production API URL

### Deployment Steps

0. **Connect to the server (Digital Ocean droplet):**
   ```bash
   ssh root@YOUR_DROPLET_IP
   # Example: ssh root@159.65.69.165
   ```
   Then go to the app directory, e.g. `cd /opt/acbc-app`.

   **First-time on this server?** Run once so `git pull` is not blocked by script permissions:
   ```bash
   git config core.fileMode false
   ```
   (The server should not have local commits; this makes Git ignore executable-bit changes from `chmod +x`.)

   **If `./scripts/deploy.sh` says "Permission denied" after a pull:** Git stores scripts as non-executable (100644), so each pull resets permissions. Either run `chmod +x scripts/deploy.sh scripts/setup-nginx.sh acbc_app/entrypoint.sh` after each pull, or fix it once in the repo (see [Scripts README](scripts/README.md#fix-permissions-permanently-in-the-repo)).

1. **Build and deploy (recommended):**
   ```bash
   ./scripts/deploy.sh
   ```
   The script reads DB credentials from `acbc_app/.env`, frees port 80 if host nginx/apache is using it, then builds and starts the stack.

   **Or build and run manually** (from project root, e.g. `/opt/acbc-app`):
   ```bash
   # Deploy creates .env.compose from acbc_app/.env; use it for compose
   docker compose --env-file .env.compose -f docker-compose.prod.yml down
   docker compose --env-file .env.compose -f docker-compose.prod.yml build --no-cache
   # Free port 80 first if needed: sudo systemctl stop nginx
   docker compose --env-file .env.compose -f docker-compose.prod.yml up -d
   sleep 10
   docker compose --env-file .env.compose -f docker-compose.prod.yml exec backend python manage.py migrate --noinput
   docker compose --env-file .env.compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
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

- Backend: `http://yourdomain.com/health/` (or `http://YOUR_IP/health/`)
- Frontend: `http://yourdomain.com/health` (or `http://YOUR_IP/health`)

**Note:** The default `nginx/nginx.conf` serves over HTTP (port 80) so the app works by IP without SSL. For HTTPS, run `./scripts/setup-ssl.sh yourdomain.com` and update nginx config with your SSL paths.

### Important Files

- Production compose: `docker-compose.prod.yml`
- Backend env: `acbc_app/.env` (main configuration)
- Root `.env`: Optional (e.g. for `VITE_*`); deploy script uses `acbc_app/.env` and creates `.env.compose` for Docker Compose substitution
- Frontend env: `frontend/.env`
- Nginx config: `nginx/nginx.conf`

**Note**: `./scripts/deploy.sh` builds `.env.compose` from `acbc_app/.env` (DB_NAME, DB_USER, DB_PASSWORD) so you only maintain `acbc_app/.env`. It also stops host nginx/apache if port 80 is in use so the container nginx can bind.

### Troubleshooting

**`git pull` says "Your local changes would be overwritten" (only file mode changes):**
```bash
git config core.fileMode false
git status   # scripts should no longer appear as modified
git pull origin main
chmod +x scripts/deploy.sh scripts/setup-nginx.sh acbc_app/entrypoint.sh  # if needed
```

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
