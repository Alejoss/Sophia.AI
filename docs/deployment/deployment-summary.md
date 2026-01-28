# Resumen de Deployment - Estado Actual

## ✅ Configuración Completa y Funcionando

### Componentes Principales

1. **Docker Compose** ✅
   - Backend (Django + Gunicorn)
   - Frontend (React + Nginx)
   - PostgreSQL 15
   - Redes y volúmenes configurados

2. **Backend Django** ✅
   - WhiteNoise para static files
   - Gunicorn en producción (3 workers)
   - Variables de entorno configuradas
   - Health check endpoint (`/health/`)

3. **Frontend React** ✅
   - Build de producción
   - Variables de entorno en build time
   - Servido por Nginx en contenedor

4. **Nginx Reverse Proxy** ✅
   - Configuración correcta
   - Location blocks en orden correcto
   - Proxy headers configurados

5. **Base de Datos** ✅
   - PostgreSQL con health checks
   - Volumen persistente
   - Variables de entorno

## 📋 Checklist de Variables de Entorno

### Backend (`acbc_app/.env`) - CRÍTICAS

```bash
# OBLIGATORIAS
ENVIRONMENT=PRODUCTION
DEBUG=False
ACADEMIA_BLOCKCHAIN_SKEY=<generar-secret-key>
ALLOWED_HOSTS=<tu-ip>,<tu-dominio>

# Base de Datos
DB_NAME=acbc_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<password-seguro>
DB_HOST=postgres
DB_PORT=5432
```

### Frontend (root `.env`) - CRÍTICAS

```bash
VITE_API_URL=http://<tu-ip>/api
VITE_GOOGLE_OAUTH_CLIENT_ID=<tu-client-id>
```

### Opcionales (pero recomendadas)

```bash
# Email
MAILGUN_DOMAIN=<tu-dominio>
MAILGUN_API_KEY=<tu-api-key>
EMAIL_FROM=noreply@academiablockchain.com
ADMIN_EMAIL=admin@academiablockchain.com

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=<tu-client-id>
GOOGLE_OAUTH_SECRET_KEY=<tu-secret>
```

## 🚀 Comandos de Deployment

### Local (desarrollo en tu máquina)

```bash
# Desde la raíz del proyecto
docker-compose up --build
```

- Usa `docker-compose.yml` + `docker-compose.override.yml` (si existe) para:
  - Montar el código fuente.
  - Montar `./acbc_app/media` en `/app/media` y **persistir archivos subidos** en tu máquina local.

### Producción (en el servidor remoto)

**Ruta del proyecto**: Usa `/opt/acbc-app` o `~/Sophia.AI` según tu setup. CI deploy usa `secrets.DEPLOY_PATH` o `~/Sophia.AI` por defecto.

```bash
# 1. Clonar y configurar (en el servidor)
cd /opt
sudo git clone <repo> acbc-app
cd acbc-app
git config --global core.fileMode false

# 2. Configurar .env
nano acbc_app/.env   # Backend (ver environment-variables.md)
nano .env            # Frontend: VITE_API_URL, VITE_GOOGLE_OAUTH_CLIENT_ID

# 3. Construir y levantar (producción)
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# 4. Migraciones y setup
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate --noinput
docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser

# 5. Nginx: si usas Nginx en host (no el contenedor)
sudo bash scripts/setup-nginx.sh
```

**Nota**: En producción se usa **`docker-compose.prod.yml`** (incl. Nginx contenedor). No uses `docker-compose.override.yml` en el servidor.

### Actualizaciones (en el servidor)

```bash
cd /opt/acbc-app   # o tu DEPLOY_PATH
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate --noinput
docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
```

## 🔍 Verificaciones

```bash
# Estado de contenedores
docker compose -f docker-compose.prod.yml ps

# Backend health (proxied by Nginx; JSON)
curl -s http://localhost/health/

# Nginx-only health (plain text, no backend)
curl -s http://localhost/health

# Static files
curl -I http://localhost/static/admin/css/base.css

# API
curl -s http://localhost/api/profiles/   # requiere auth según endpoint

# Frontend
curl -I http://localhost/
```

## ⚠️ Pendiente (Opcional pero Recomendado)

1. **SSL/HTTPS**
   - Script: `scripts/setup-ssl.sh` (ver [README](../../scripts/README.md))
   - Requiere dominio; Let's Encrypt con Certbot. Actualizar `nginx/nginx.conf` con el dominio real.

2. **Backups automáticos**
   - Script: `scripts/backup-db.sh`. Ejecutar desde la raíz del proyecto; usa `docker-compose.prod.yml`.
   - Cron: `0 2 * * * cd /opt/acbc-app && ./scripts/backup-db.sh` (ver [scripts/README](../../scripts/README.md)).

3. **Monitoreo**
   - Alertas básicas y monitoreo de recursos (CPU, RAM, disco). Health: `GET /health/` (backend), `GET /health` (nginx).

4. **Logs**
   - Rotación: `LOGGING` en `settings.py` usa `RotatingFileHandler` (tamaño y backup count). Ver [logging-and-observability](../../docs/backend/logging-and-observability.md).
   - Centralización opcional (e.g. Sentry, agregador de logs).

## ✅ Estado Final

**La aplicación está lista para producción básica/MVP.**

Todos los componentes críticos están configurados y funcionando:
- ✅ Docker y contenedores
- ✅ Backend Django con Gunicorn
- ✅ Frontend React
- ✅ PostgreSQL
- ✅ Nginx reverse proxy
- ✅ Static y media files
- ✅ Health checks
- ✅ Restart policies

**Solo falta:**
- ⚠️ Configurar variables de entorno en el servidor
- ⚠️ Ejecutar migraciones (primera vez)
- ⚠️ Configurar Nginx (si no está hecho)
- ⚠️ SSL/HTTPS (opcional pero recomendado)
