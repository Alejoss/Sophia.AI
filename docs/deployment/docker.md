# Docker Configuration

This document describes the Docker setup for the Sophia.AI Academia Blockchain platform.

## Docker Compose Overview

The project uses Docker Compose to orchestrate three main services:

- **backend**: Django REST Framework API
- **frontend**: React application with Vite
- **postgres**: PostgreSQL database

## Service Configuration

### Backend Service

**Image**: Built from `acbc_app/backend.Dockerfile`

**Configuration**:
- **Port**: 8000
- **Volumes**:
  - `./acbc_app:/app` - Application code
  - `static_volume:/app/static` - Static files
  - `/var/www/sophia-ai/staticfiles:/app/staticfiles` - Production static files
  - `/var/www/sophia-ai/media:/app/media` - Media files
- **Environment**: Loads from `acbc_app/.env`
- **Dependencies**: Waits for postgres to be healthy

**Dockerfile**: `acbc_app/backend.Dockerfile`
- Base: `python:3.12-slim-bookworm`
- Installs system dependencies (PostgreSQL client, gettext)
- Installs Python dependencies from `requirements.txt`
- Creates logs directory
- Exposes port 8000

### Frontend Service

**Image**: Built from `frontend/frontend.Dockerfile`

**Configuration**:
- **Port**: 5173
- **Volumes**:
  - `./frontend:/app` - Application code
  - `/app/node_modules` - Node modules (named volume)
- **Environment**:
  - `NODE_ENV=development`
  - `CHOKIDAR_USEPOLLING=true` - File watching in Docker
- **Command**: `npm run dev -- --host 0.0.0.0`

**Dockerfile**: `frontend/frontend.Dockerfile`
- Base: `node:16`
- Installs npm dependencies
- Exposes port 5173
- Runs Vite dev server

### PostgreSQL Service

**Image**: `postgres:15`

**Configuration**:
- **Port**: 5432 (internal)
- **Volumes**:
  - `postgres_data:/var/lib/postgresql/data` - Persistent data
- **Environment**:
  - `POSTGRES_DB=acbc_db`
  - `POSTGRES_USER=postgres`
  - `POSTGRES_PASSWORD=postgres`
- **Health Check**: Checks if PostgreSQL is ready

## Volumes

### Named Volumes

- **postgres_data**: PostgreSQL database files
- **static_volume**: Static files for backend

### Bind Mounts

- Application code mounted for live development
- Media and static files can be mounted for production

## Networks

All services are connected to `app_network` (bridge driver).

## Usage

### Start Services

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Build and start
docker-compose up --build
```

### Stop Services

```bash
# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Execute Commands

```bash
# Backend commands
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser

# Access shell
docker-compose exec backend bash
docker-compose exec frontend bash
docker-compose exec postgres bash
```

### Rebuild Services

```bash
# Rebuild all
docker-compose build

# Rebuild specific service
docker-compose build backend

# Rebuild and restart
docker-compose up --build backend
```

## Development vs Production

### Development

- Code mounted as volumes for live editing
- Hot reload enabled
- Debug mode enabled
- Development dependencies included

### Production

For production, consider:

1. **Multi-stage builds** for smaller images
2. **Non-root user** in containers
3. **Read-only file systems** where possible
4. **Resource limits** in docker-compose
5. **Separate compose file** for production

Example production docker-compose override:

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    command: gunicorn academia_blockchain.wsgi:application --bind 0.0.0.0:8000
    environment:
      - DEBUG=False
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

Run with:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs service-name

# Check container status
docker-compose ps

# Restart service
docker-compose restart service-name
```

### Database Connection Issues

```bash
# Check postgres is healthy
docker-compose ps postgres

# Test connection
docker-compose exec backend python manage.py dbshell

# Check postgres logs
docker-compose logs postgres
```

### Port Conflicts

If ports 8000 or 5173 are already in use:

1. Stop conflicting services
2. Or modify ports in `docker-compose.yml`:
   ```yaml
   ports:
     - "8001:8000"  # Change host port
   ```

### Volume Issues

```bash
# Remove volumes
docker-compose down -v

# Check volume contents
docker volume inspect sophia-ai-academia-blockchain_postgres_data
```

### Rebuild from Scratch

```bash
# Stop and remove everything
docker-compose down -v
docker system prune -a

# Rebuild
docker-compose build --no-cache
docker-compose up
```

## Best Practices

1. **Use .env files** for environment variables
2. **Don't commit .env files** to version control
3. **Use named volumes** for persistent data
4. **Set resource limits** in production
5. **Keep images updated** regularly
6. **Use multi-stage builds** for smaller images
7. **Implement health checks** for all services

## Related Documentation

- [Local Development](local-development.md)
- [Production Deployment](production.md)
- [Environment Variables](environment-variables.md)

