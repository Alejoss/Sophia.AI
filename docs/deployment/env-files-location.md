# Ubicación de Archivos .env

## Resumen

Necesitas **2 ubicaciones** para las variables de entorno:

1. **`/opt/acbc-app/acbc_app/.env`** - Variables del backend
2. **Variables VITE_*** - Para el frontend (build time en GitHub Actions; root `.env` solo para build manual/local)

---

## 1. Backend: `/opt/acbc-app/acbc_app/.env`

**Ubicación:** `acbc_app/.env` (dentro del directorio del backend)

**Contenido mínimo para producción:**

```env
# ============================================================================
# DJANGO CORE - REQUERIDO
# ============================================================================
ENVIRONMENT=PRODUCTION
DEBUG=False
ALLOWED_HOSTS=159.65.69.165
ACADEMIA_BLOCKCHAIN_SKEY=<tu-secret-key-generado>

# ============================================================================
# BASE DE DATOS - REQUERIDO
# ============================================================================
DB_NAME=acbc_db
DB_USER=postgres
DB_PASSWORD=<tu-password-seguro>
DB_HOST=postgres
DB_PORT=5432

POSTGRES_DB=acbc_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<tu-password-seguro>

# ============================================================================
# OPCIONAL (configurar según necesites)
# ============================================================================
# GOOGLE_OAUTH_CLIENT_ID=...
# GOOGLE_OAUTH_SECRET_KEY=...
# EMAIL_HOST_USER=...
# EMAIL_HOST_PASSWORD=...
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
```

**Verificar ubicación:**
```bash
cd /opt/acbc-app
ls -la acbc_app/.env
cat acbc_app/.env
```

---

## 2. Frontend: Variables VITE_* (Build Time)

El frontend necesita variables `VITE_*` **en tiempo de build**.

### Deploy normal: GitHub Actions (RECOMENDADO)

Configura estas **Repository variables** en GitHub:

```env
VITE_API_URL=https://tu-dominio.com/api
VITE_GOOGLE_OAUTH_CLIENT_ID=tu-google-oauth-client-id.apps.googleusercontent.com
```

GitHub Actions las usa para publicar la imagen frontend en GHCR. El servidor no necesita estas variables para el deploy normal.

### Build manual/local: Archivo `.env` en la raíz

**Ubicación:** `/opt/acbc-app/.env` (en la raíz, junto a `docker-compose.yml`)

**Contenido:**
```env
# Variables para el build del frontend
VITE_API_URL=http://159.65.69.165:8000/api
VITE_GOOGLE_OAUTH_CLIENT_ID=tu-google-oauth-client-id.apps.googleusercontent.com
```

**Ventajas:**
- Útil cuando ejecutas `./scripts/deploy.sh --build-local`
- Docker Compose las lee durante el build manual

**Verificar:**
```bash
cd /opt/acbc-app
ls -la .env
cat .env
```

### Build manual/local: Variables de entorno del sistema

**Antes de hacer `./scripts/deploy.sh --build-local`:**

```bash
export VITE_API_URL=http://159.65.69.165:8000/api
export VITE_GOOGLE_OAUTH_CLIENT_ID=tu-client-id
./scripts/deploy.sh --build-local
```

**Desventajas:**
- Se pierden al cerrar sesión
- Hay que exportarlas cada vez

---

## Estructura Final en el Servidor

```
/opt/acbc-app/
├── docker-compose.prod.yml      # ✅ En git (usa imágenes GHCR)
├── docker-compose.build.yml     # ✅ En git (solo para --build-local)
├── .env                         # ❌ NO en git (opcional: IMAGE_TAG/GHCR_IMAGE_PREFIX/VITE_* para --build-local)
├── acbc_app/
│   ├── .env                     # ❌ NO en git (variables backend)
│   ├── backend.Dockerfile       # ✅ En git
│   └── entrypoint.sh            # ✅ En git
├── frontend/
│   ├── frontend.prod.Dockerfile # ✅ En git
│   └── nginx.conf               # ✅ En git
└── ...
```

---

## Comandos para Configurar

### 1. Crear/editar `.env` del backend
```bash
cd /opt/acbc-app
nano acbc_app/.env
# Pegar contenido del backend
```

### 2. Crear `.env` en la raíz (opcional)
```bash
cd /opt/acbc-app
nano .env
# Pegar:
# IMAGE_TAG=main
# GHCR_IMAGE_PREFIX=ghcr.io/<owner>/<repo>
# VITE_API_URL=http://159.65.69.165:8000/api               # solo --build-local
# VITE_GOOGLE_OAUTH_CLIENT_ID=tu-client-id                 # solo --build-local
```

### 3. Verificar permisos
```bash
chmod 600 acbc_app/.env
chmod 600 .env
```

### 4. Verificar variables del deploy normal
```bash
cd /opt/acbc-app
./scripts/deploy.sh --help
# Para config completa usa Docker Compose con .env.compose generado por deploy.sh
```

---

## Verificación Completa

```bash
# 1. Verificar .env del backend
cd /opt/acbc-app
cat acbc_app/.env | grep -E "ENVIRONMENT|DEBUG|ALLOWED_HOSTS|DB_PASSWORD"

# 2. Verificar .env de la raíz si usas overrides
cat .env | grep -E "IMAGE_TAG|GHCR_IMAGE_PREFIX|VITE_"

# 3. Verificar que docker-compose las lee
docker compose config | grep -A 5 "VITE_API_URL"
```

---

## Importante

1. **Nunca hacer commit de `.env`** - Ambos archivos deben estar en `.gitignore`
2. **`VITE_API_URL`** debe apuntar al backend accesible desde el navegador
   - Si accedes por IP: `http://159.65.69.165:8000/api`
   - Si tienes dominio: `https://api.tudominio.com/api`
3. **Después de cambiar `VITE_*`**:
   - Deploy normal: actualiza la GitHub Repository variable, deja que el workflow publique una nueva imagen y ejecuta `./scripts/deploy.sh`.
   - Build manual/local:
   ```bash
   ./scripts/deploy.sh --build-local
   ```

---

## Troubleshooting

### Error: "VITE_API_URL is not defined"
- Deploy normal: verificar que `VITE_API_URL` esté en GitHub Repository variables y que exista una imagen GHCR publicada después del cambio.
- Build manual/local: verificar que `.env` en la raíz tenga `VITE_API_URL` y ejecutar `./scripts/deploy.sh --build-local`.

### Error: "ALLOWED_HOSTS must be set"
- Verificar que `acbc_app/.env` tenga `ALLOWED_HOSTS=159.65.69.165`

### Frontend no conecta con backend
- Verificar que `VITE_API_URL` sea accesible desde el navegador
- Verificar que el backend esté corriendo: `curl http://localhost:8000/health/`
