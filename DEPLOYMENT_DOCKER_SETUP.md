# Docker Setup - Guía de Configuración

## Resumen

El setup de Docker está configurado para funcionar tanto en desarrollo como en producción usando el mismo `docker-compose.yml`. La configuración se controla mediante variables de entorno en el archivo `.env`.

## Archivos Clave

### Backend
- **`acbc_app/backend.Dockerfile`**: Dockerfile del backend
- **`acbc_app/entrypoint.sh`**: Script que elige entre Gunicorn (producción) o runserver (desarrollo)
- **`acbc_app/.env`**: Variables de entorno del backend (NO en git)

### Frontend
- **`frontend/frontend.prod.Dockerfile`**: Dockerfile de producción (multi-stage con nginx)
- **`frontend/frontend.Dockerfile`**: Dockerfile de desarrollo (Vite dev server)
- **`frontend/nginx.conf`**: Configuración de nginx para servir archivos estáticos

### Docker Compose
- **`docker-compose.yml`**: Configuración principal (en git)
- Lee variables del `.env` del backend
- Usa `frontend.prod.Dockerfile` por defecto (producción)

## Variables de Entorno Necesarias

### En el servidor (para docker-compose build)

El frontend necesita variables `VITE_*` en tiempo de build. Estas se pueden definir:

1. **Como variables de entorno del sistema** antes de `docker compose build`:
   ```bash
   export VITE_API_URL=http://159.65.69.165:8000/api
   export VITE_GOOGLE_OAUTH_CLIENT_ID=tu-client-id
   docker compose build
   ```

2. **O crear un archivo `.env` en la raíz del proyecto** (fuera de git):
   ```bash
   # .env (en la raíz, junto a docker-compose.yml)
   VITE_API_URL=http://159.65.69.165:8000/api
   VITE_GOOGLE_OAUTH_CLIENT_ID=tu-client-id
   ```

### En `acbc_app/.env` (backend)

Ver `acbc_app/env_example.txt` para todas las variables. Las más importantes:

```env
# REQUERIDO
ENVIRONMENT=PRODUCTION
DEBUG=False
ALLOWED_HOSTS=159.65.69.165
ACADEMIA_BLOCKCHAIN_SKEY=<generar-key-segura>

# Base de datos
DB_NAME=acbc_db
DB_USER=postgres
DB_PASSWORD=<password-seguro>
DB_HOST=postgres
DB_PORT=5432

POSTGRES_DB=acbc_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<password-seguro>
```

## Cómo Funciona

### Backend
1. `entrypoint.sh` lee `ENVIRONMENT` del `.env`
2. Si `ENVIRONMENT=PRODUCTION` → ejecuta Gunicorn
3. Si `ENVIRONMENT=DEVELOPMENT` → ejecuta Django runserver

### Frontend
1. Por defecto usa `frontend.prod.Dockerfile`
2. Build time: Vite inyecta `VITE_API_URL` y `VITE_GOOGLE_OAUTH_CLIENT_ID` en el bundle
3. Runtime: nginx sirve los archivos estáticos desde `/usr/share/nginx/html`

### PostgreSQL
- Corre en Docker
- Datos persisten en volumen `postgres_data`
- Health check configurado

## Comandos de Despliegue

```bash
# 1. Configurar variables de entorno del frontend (si no están en .env raíz)
export VITE_API_URL=http://159.65.69.165:8000/api
export VITE_GOOGLE_OAUTH_CLIENT_ID=tu-client-id

# 2. Construir imágenes
docker compose build

# 3. Iniciar servicios
docker compose up -d

# 4. Ejecutar migraciones
docker compose exec backend python manage.py migrate

# 5. Colectar archivos estáticos
docker compose exec backend python manage.py collectstatic --noinput

# 6. Ver logs
docker compose logs -f

# 7. Verificar salud
curl http://localhost:8000/health/
curl http://localhost:80/health
```

## Verificación

### Backend
```bash
# Health check
curl http://localhost:8000/health/

# Debe responder: {"status": "healthy", "service": "academia_blockchain"}
```

### Frontend
```bash
# Health check
curl http://localhost:80/health

# Debe responder: healthy
```

### PostgreSQL
```bash
# Verificar conexión
docker compose exec postgres psql -U postgres -d acbc_db -c "SELECT version();"
```

## Troubleshooting

### Error: "ALLOWED_HOSTS must be set in production"
- Verificar que `ALLOWED_HOSTS` esté en `.env` con el IP/dominio correcto

### Error: "DEBUG must be False in production"
- Verificar que `DEBUG=False` en `.env`

### Frontend no conecta con backend
- Verificar que `VITE_API_URL` apunte al backend correcto
- Reconstruir frontend: `docker compose build frontend`

### Volúmenes no persisten
- Verificar que los volúmenes estén definidos en `docker-compose.yml`
- Listar volúmenes: `docker volume ls`

## Notas Importantes

1. **Solo `.env` queda fuera del repo** - Todo lo demás está versionado
2. **Variables VITE_*** se necesitan en build time, no runtime
3. **En producción**, el código del backend ya está en la imagen (aunque se monte el volumen, entrypoint.sh usa el código de la imagen)
4. **En producción**, nginx sirve desde `/usr/share/nginx/html`, no desde `/app`
