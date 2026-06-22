# Checklist de Deployment - Producción

## ✅ Configuración Completada

### 1. Docker y Contenedores
- [x] `docker-compose.yml` configurado correctamente
- [x] `backend.Dockerfile` con entrypoint.sh
- [x] `entrypoint.sh` elige Gunicorn en producción
- [x] Volúmenes configurados (static, media, postgres)
- [x] Health checks configurados para postgres
- [x] Restart policies configuradas (`unless-stopped`)

### 2. Django Backend
- [x] WhiteNoise configurado para static files
- [x] `DEBUG=False` en producción (validado)
- [x] `ALLOWED_HOSTS` configurado desde variables de entorno
- [x] `SECRET_KEY` validado (no puede ser el default)
- [x] Gunicorn configurado (3 workers, timeout 120s)
- [x] Static files funcionando (admin CSS cargando)

### 3. Nginx
- [x] Configuración de reverse proxy
- [x] Location blocks en orden correcto (`/static`, `/media`, `/api`, `/admin` antes de `/`)
- [x] Proxy headers configurados (X-Real-IP, X-Forwarded-For, etc.)
- [x] Timeouts configurados
- [x] CORS headers para `/api`

### 4. Base de Datos
- [x] PostgreSQL 15 configurado
- [x] Health checks configurados
- [x] Volumen persistente para datos
- [x] Variables de entorno para conexión

### 5. Frontend
- [x] Build de producción configurado
- [x] Variables de entorno en build time (`VITE_API_URL`, `VITE_GOOGLE_OAUTH_CLIENT_ID`)
- [x] Nginx sirve frontend desde contenedor

## ⚠️ Verificaciones Requeridas

### Variables de Entorno (Backend `.env`)

**CRÍTICAS (deben estar configuradas):**
```bash
ENVIRONMENT=PRODUCTION
DEBUG=False
ACADEMIA_BLOCKCHAIN_SKEY=<secret-key-generado>
ALLOWED_HOSTS=<tu-ip>,<tu-dominio>  # Ej: 159.65.69.165,academiablockchain.com
```

**Base de Datos:**
```bash
DB_NAME=acbc_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<password-seguro>
DB_HOST=postgres
DB_PORT=5432
```

**Opcionales (pero recomendados):**
```bash
# Email: por defecto desactivado (SEND_EMAILS=false). Cuando Postmark esté aprobado:
# SEND_EMAILS=true
# POSTMARK_SERVER_TOKEN=<tu-server-token-postmark>
EMAIL_FROM=noreply@academiablockchain.com
ADMIN_EMAIL=admin@academiablockchain.com

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=<tu-client-id>
GOOGLE_OAUTH_SECRET_KEY=<tu-secret>

# AWS S3 (si planeas usarlo)
AWS_ACCESS_KEY_ID=<opcional>
AWS_SECRET_ACCESS_KEY=<opcional>
```

### Variables de Entorno (Frontend - GitHub Actions)

```bash
VITE_API_URL=http://<tu-ip>/api  # O https://<tu-dominio>/api si tienes SSL
VITE_GOOGLE_OAUTH_CLIENT_ID=<tu-client-id>
```

Configúralas como **Repository variables** en GitHub para que el workflow publique la imagen frontend en GHCR. Solo necesitas ponerlas en el root `.env` del servidor si vas a ejecutar `./scripts/deploy.sh --build-local`.

## 🔧 Pasos de Deployment

### 1. Preparación del Servidor

```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Docker y Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt install docker-compose-plugin -y

# Configurar firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Clonar repositorio
cd /opt
sudo git clone <tu-repo-url> acbc-app
cd acbc-app
sudo git config --global core.fileMode false
```

### 2. Configurar Variables de Entorno

```bash
# Backend .env
cd /opt/acbc-app
sudo nano acbc_app/.env
# Agregar todas las variables críticas

# Root .env opcional
sudo nano .env
# Agregar IMAGE_TAG/GHCR_IMAGE_PREFIX si quieres fijarlos.
# Agregar VITE_API_URL y VITE_GOOGLE_OAUTH_CLIENT_ID solo para --build-local.
```

### 3. Pull de Imágenes GHCR y Levantar Contenedores

**Producción**: Usa `docker-compose.prod.yml` con imágenes preconstruidas en GHCR. **Local**: Usa `docker-compose.yml` (opcionalmente `docker-compose.override.yml`).

```bash
cd /opt/acbc-app   # o ~/Sophia.AI, según tu DEPLOY_PATH

# Producción: pull GHCR + up + migraciones + collectstatic + health checks
./scripts/deploy.sh

# Build manual/local en el servidor solo cuando sea necesario
./scripts/deploy.sh --build-local
./scripts/deploy.sh --build-local --no-cache

# Verificar que están corriendo
docker compose -f docker-compose.prod.yml ps
```

### 4. Configurar Base de Datos

```bash
# Ejecutar migraciones (producción)
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate --noinput

# Crear superusuario (opcional)
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser

# Colectar static files
docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput

# Miniaturas de portada para listados de temas (backfill; ver DEPLOYMENT_QUICK_START.md)
docker compose --env-file .env.compose -f docker-compose.prod.yml exec backend python manage.py generate_topic_thumbnails
```

### 5. Configurar Nginx

```bash
# Instalar Nginx
sudo apt install nginx -y

# Copiar configuración
sudo cp /opt/acbc-app/nginx/nginx-server.conf /etc/nginx/sites-available/acbc-app

# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/acbc-app /etc/nginx/sites-enabled/

# Remover default
sudo rm /etc/nginx/sites-enabled/default

# Probar configuración
sudo nginx -t

# Recargar Nginx
sudo systemctl reload nginx
```

### 6. Verificaciones Post-Deployment

```bash
# 1. Verificar contenedores
docker compose -f docker-compose.prod.yml ps
# Todos deben estar "Up"

# 2. Backend health (Nginx proxy a Django /health/)
curl -s http://localhost/health/
# Debe devolver {"status": "healthy", "service": "academia_blockchain"}

# 3. Verificar static files
curl -I http://localhost/static/admin/css/base.css
# Debe devolver HTTP 200

# 4. Verificar frontend
curl -I http://localhost/
# Debe devolver HTTP 200

# 5. Verificar logs
docker compose -f docker-compose.prod.yml logs backend --tail=20
# No debe haber errores críticos
```

## 🔒 Seguridad

### Pendiente (Recomendado para producción)

- [ ] **SSL/HTTPS**: `scripts/setup-ssl.sh`; Let's Encrypt. Ver [setup-ssl](../../scripts/README.md#setup-sslsh).
- [ ] **Firewall**: Verificar que solo puertos necesarios están abiertos (22, 80, 443).
- [ ] **Backups**: `scripts/backup-db.sh`; cron. Ver [scripts/README](../../scripts/README.md#backup-dbsh).
- [ ] **Monitoreo**: Alertas y monitoreo básico; health `GET /health/`, `GET /health`.
- [ ] **Logs**: Rotación vía `LOGGING` (RotatingFileHandler). Ver [logging-and-observability](../../docs/backend/logging-and-observability.md).
- [ ] **Actualizaciones**: Actualizaciones de seguridad del SO y de imágenes Docker.

### SSL/HTTPS (Opcional pero Recomendado)

- Script: `scripts/setup-ssl.sh`. Ver [scripts/README](../../scripts/README.md).
- Actualizar `nginx/nginx.conf` (o `nginx-server.conf` si Nginx en host): reemplazar `yourdomain.com` por tu dominio. Certbot: `certbot certonly --webroot -w /var/www/certbot -d tu-dominio.com`.

## 📊 Monitoreo Básico

### Comandos Útiles

```bash
# Ver estado de contenedores (producción)
docker compose -f docker-compose.prod.yml ps

# Ver logs en tiempo real
docker compose -f docker-compose.prod.yml logs -f backend

# Ver uso de recursos
docker stats

# Ver espacio en disco
df -h
docker system df

# Verificar salud de servicios
curl -s http://localhost/health/
```

## 🔄 Mantenimiento

### Modo mantenimiento (Cloudflare)

Antes de cambios de infra (SSL, nginx, certbot), activá la regla **`maintainance-mode`** en Cloudflare para redirigir todo el tráfico a la página de mantenimiento.

Documentación completa: **[cloudflare-maintenance-mode.md](cloudflare-maintenance-mode.md)**

Resumen:

1. Cloudflare → **Rules** → **Overview** → `maintainance-mode` → **Enabled**
2. Trabajá en el servidor (SSL, deploy, etc.)
3. Verificá redirects y health
4. **Disabled** para volver al sitio normal

**Nota certbot:** desactivá la regla 1–2 minutos mientras corre `./scripts/setup-ssl.sh`, o añadí excepción para `/.well-known/acme-challenge/` (ver doc).

### Actualizar Aplicación

```bash
cd /opt/acbc-app   # o tu DEPLOY_PATH

git pull origin main

# Deploy normal: pull de imágenes GHCR + up + migraciones + collectstatic
./scripts/deploy.sh

# Reconstrucción local limpia solo si necesitas construir en el servidor
./scripts/deploy.sh --build-local --no-cache
```

### Backups

Usa `scripts/backup-db.sh` y `scripts/restore-db.sh` (desde la raíz del proyecto; usan `docker-compose.prod.yml`). Ver [scripts/README](../../scripts/README.md).

```bash
cd /opt/acbc-app
./scripts/backup-db.sh
# Restaurar: ./scripts/restore-db.sh backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

## ❌ Problemas Comunes

### Contenedor no inicia
```bash
# Ver logs (producción)
docker compose -f docker-compose.prod.yml logs backend

# Verificar variables de entorno
docker compose -f docker-compose.prod.yml exec backend env | grep ENVIRONMENT
```

### Static files no cargan
```bash
# Ejecutar collectstatic (producción)
docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
docker compose -f docker-compose.prod.yml restart backend
```

### Base de datos no conecta
```bash
# Verificar que postgres está corriendo
docker compose -f docker-compose.prod.yml ps postgres

# Ver logs de postgres
docker compose -f docker-compose.prod.yml logs postgres

# Verificar variables de entorno
docker compose -f docker-compose.prod.yml exec backend python -c "from django.conf import settings; print(settings.DATABASES)"
```

### Nginx 502 Bad Gateway
```bash
# Verificar que backend está corriendo
docker compose -f docker-compose.prod.yml ps backend

# Ver logs del backend
docker compose -f docker-compose.prod.yml logs backend --tail=50

# Verificar que backend responde (dentro del contenedor)
docker compose -f docker-compose.prod.yml exec backend python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health/')"
```

## 📝 Notas Finales

- **Puerto 80**: Nginx escucha en puerto 80
- **Puerto 8000**: Backend Django/Gunicorn (interno, no expuesto)
- **Puerto 8080**: Frontend React (interno, no expuesto)
- **Puerto 5432**: PostgreSQL (interno, no expuesto)

- **Volúmenes**: Los datos persisten en volúmenes Docker
  - `postgres_data`: Base de datos
  - `static_volume`: Static files
  - `media_volume`: Media files

- **Logs**: Los logs de Django están en `/app/logs` dentro del contenedor

## ✅ Estado Actual

**Funcionando:**
- ✅ Docker Compose
- ✅ Backend Django con Gunicorn
- ✅ Frontend React
- ✅ PostgreSQL
- ✅ Nginx reverse proxy
- ✅ Static files (WhiteNoise)
- ✅ Media files
- ✅ Health checks

**Pendiente (Opcional):**
- ⚠️ SSL/HTTPS (Let's Encrypt)
- ⚠️ Backups automáticos
- ⚠️ Monitoreo avanzado
- ⚠️ Rotación de logs

**La aplicación está lista para producción básica/MVP.**
