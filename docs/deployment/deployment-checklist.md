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
# Email (si usas Mailgun)
MAILGUN_DOMAIN=<tu-dominio-mailgun>
MAILGUN_API_KEY=<tu-api-key>
EMAIL_FROM=noreply@academiablockchain.com
ADMIN_EMAIL=admin@academiablockchain.com

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=<tu-client-id>
GOOGLE_OAUTH_SECRET_KEY=<tu-secret>

# AWS S3 (si planeas usarlo)
AWS_ACCESS_KEY_ID=<opcional>
AWS_SECRET_ACCESS_KEY=<opcional>
```

### Variables de Entorno (Frontend - root `.env`)

```bash
VITE_API_URL=http://<tu-ip>/api  # O https://<tu-dominio>/api si tienes SSL
VITE_GOOGLE_OAUTH_CLIENT_ID=<tu-client-id>
```

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

# Frontend .env (en root del proyecto)
sudo nano .env
# Agregar VITE_API_URL y VITE_GOOGLE_OAUTH_CLIENT_ID
```

### 3. Construir y Levantar Contenedores

```bash
cd /opt/acbc-app

# Construir contenedores
docker compose build

# Levantar servicios
docker compose up -d

# Verificar que están corriendo
docker compose ps
```

### 4. Configurar Base de Datos

```bash
# Ejecutar migraciones
docker compose exec backend python manage.py migrate

# Crear superusuario (opcional)
docker compose exec backend python manage.py createsuperuser

# Colectar static files
docker compose exec backend python manage.py collectstatic --noinput
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
docker compose ps
# Todos deben estar "Up"

# 2. Verificar health check
curl http://localhost/health/
# Debe devolver {"status": "healthy", "service": "academia_blockchain"}

# 3. Verificar static files
curl -I http://localhost/static/admin/css/base.css
# Debe devolver HTTP 200

# 4. Verificar API
curl http://localhost/api/health/
# Debe devolver JSON con status

# 5. Verificar frontend
curl -I http://localhost/
# Debe devolver HTTP 200

# 6. Verificar logs
docker compose logs backend --tail=20
# No debe haber errores críticos
```

## 🔒 Seguridad

### Pendiente (Recomendado para producción)

- [ ] **SSL/HTTPS**: Configurar Let's Encrypt con Certbot
- [ ] **Firewall**: Verificar que solo puertos necesarios están abiertos
- [ ] **Backups**: Configurar backups automáticos de base de datos
- [ ] **Monitoreo**: Configurar alertas y monitoreo básico
- [ ] **Logs**: Configurar rotación de logs
- [ ] **Actualizaciones**: Configurar actualizaciones automáticas de seguridad

### SSL/HTTPS (Opcional pero Recomendado)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtener certificado (reemplaza con tu dominio)
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Renovación automática
sudo certbot renew --dry-run
```

## 📊 Monitoreo Básico

### Comandos Útiles

```bash
# Ver estado de contenedores
docker compose ps

# Ver logs en tiempo real
docker compose logs -f backend

# Ver uso de recursos
docker stats

# Ver espacio en disco
df -h
docker system df

# Verificar salud de servicios
curl http://localhost/health/
```

## 🔄 Mantenimiento

### Actualizar Aplicación

```bash
cd /opt/acbc-app

# Pull de cambios
git pull origin main

# Reconstruir si hay cambios en Dockerfiles o requirements
docker compose build backend  # Solo si cambió backend.Dockerfile o requirements.txt
docker compose build frontend  # Solo si cambió frontend.prod.Dockerfile

# Reiniciar servicios
docker compose restart backend frontend

# Si hay migraciones
docker compose exec backend python manage.py migrate

# Si hay cambios en static files
docker compose exec backend python manage.py collectstatic --noinput
```

### Backups

```bash
# Backup de base de datos
docker compose exec postgres pg_dump -U postgres acbc_db > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker compose exec -T postgres psql -U postgres acbc_db < backup_20260122.sql
```

## ❌ Problemas Comunes

### Contenedor no inicia
```bash
# Ver logs
docker compose logs backend

# Verificar variables de entorno
docker compose exec backend env | grep ENVIRONMENT
```

### Static files no cargan
```bash
# Ejecutar collectstatic
docker compose exec backend python manage.py collectstatic --noinput
docker compose restart backend
```

### Base de datos no conecta
```bash
# Verificar que postgres está corriendo
docker compose ps postgres

# Ver logs de postgres
docker compose logs postgres

# Verificar variables de entorno
docker compose exec backend python -c "from django.conf import settings; print(settings.DATABASES)"
```

### Nginx 502 Bad Gateway
```bash
# Verificar que backend está corriendo
docker compose ps backend

# Ver logs del backend
docker compose logs backend --tail=50

# Verificar que backend responde
docker compose exec backend curl http://localhost:8000/health/
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
