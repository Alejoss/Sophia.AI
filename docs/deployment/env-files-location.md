# Ubicación de Archivos .env

## Resumen

Necesitas **2 ubicaciones** para las variables de entorno:

1. **`/opt/acbc-app/acbc_app/.env`** - Variables del backend
2. **Variables VITE_*** - Para el frontend (build time)

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
# MAILGUN_DOMAIN=...
# MAILGUN_API_KEY=...
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

El frontend necesita variables `VITE_*` **en tiempo de build**. Tienes 2 opciones:

### Opción A: Archivo `.env` en la raíz (RECOMENDADO)

**Ubicación:** `/opt/acbc-app/.env` (en la raíz, junto a `docker-compose.yml`)

**Contenido:**
```env
# Variables para el build del frontend
VITE_API_URL=http://159.65.69.165:8000/api
VITE_GOOGLE_OAUTH_CLIENT_ID=tu-google-oauth-client-id.apps.googleusercontent.com
```

**Ventajas:**
- Todo en un lugar
- Docker Compose las lee automáticamente
- Fácil de mantener

**Verificar:**
```bash
cd /opt/acbc-app
ls -la .env
cat .env
```

### Opción B: Variables de entorno del sistema

**Antes de hacer `docker compose build`:**

```bash
export VITE_API_URL=http://159.65.69.165:8000/api
export VITE_GOOGLE_OAUTH_CLIENT_ID=tu-client-id
docker compose build frontend
```

**Desventajas:**
- Se pierden al cerrar sesión
- Hay que exportarlas cada vez

---

## Estructura Final en el Servidor

```
/opt/acbc-app/
├── docker-compose.yml          # ✅ En git
├── .env                         # ❌ NO en git (variables VITE_*)
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

### 2. Crear `.env` en la raíz (para VITE_*)
```bash
cd /opt/acbc-app
nano .env
# Pegar:
# VITE_API_URL=http://159.65.69.165:8000/api
# VITE_GOOGLE_OAUTH_CLIENT_ID=tu-client-id
```

### 3. Verificar permisos
```bash
chmod 600 acbc_app/.env
chmod 600 .env
```

### 4. Verificar que Docker Compose las lee
```bash
cd /opt/acbc-app
docker compose config | grep VITE_API_URL
# Debe mostrar: VITE_API_URL: http://159.65.69.165:8000/api
```

---

## Verificación Completa

```bash
# 1. Verificar .env del backend
cd /opt/acbc-app
cat acbc_app/.env | grep -E "ENVIRONMENT|DEBUG|ALLOWED_HOSTS|DB_PASSWORD"

# 2. Verificar .env de la raíz (VITE_*)
cat .env | grep VITE_

# 3. Verificar que docker-compose las lee
docker compose config | grep -A 5 "VITE_API_URL"
```

---

## Importante

1. **Nunca hacer commit de `.env`** - Ambos archivos deben estar en `.gitignore`
2. **`VITE_API_URL`** debe apuntar al backend accesible desde el navegador
   - Si accedes por IP: `http://159.65.69.165:8000/api`
   - Si tienes dominio: `https://api.tudominio.com/api`
3. **Después de cambiar `.env`**, reconstruir frontend:
   ```bash
   docker compose build frontend
   docker compose up -d frontend
   ```

---

## Troubleshooting

### Error: "VITE_API_URL is not defined"
- Verificar que `.env` en la raíz tenga `VITE_API_URL`
- Reconstruir: `docker compose build frontend`

### Error: "ALLOWED_HOSTS must be set"
- Verificar que `acbc_app/.env` tenga `ALLOWED_HOSTS=159.65.69.165`

### Frontend no conecta con backend
- Verificar que `VITE_API_URL` sea accesible desde el navegador
- Verificar que el backend esté corriendo: `curl http://localhost:8000/health/`
