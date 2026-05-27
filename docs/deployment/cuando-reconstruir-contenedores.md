# ¿Cuándo Reconstruir o Reiniciar Contenedores?

## Resumen Rápido

> Producción ahora usa imágenes preconstruidas en GHCR. En deploy normal no ejecutes `docker compose build`; actualiza `main`, deja que GitHub Actions publique las imágenes y corre `./scripts/deploy.sh`. Usa `./scripts/deploy.sh --build-local` solo si intencionalmente quieres construir en el servidor.

| Cambio | ¿Parar contenedores? | ¿Reconstruir? | ¿Reiniciar? |
|--------|---------------------|---------------|-------------|
| Configuración de Nginx (sistema) | ❌ No | ❌ No | ❌ No |
| Scripts de deployment | ❌ No | ❌ No | ❌ No |
| Variables de entorno (.env) | ❌ No | ❌ No | ✅ Sí (para cargar nuevas vars) |
| Código del backend | ✅ Sí | ✅ Sí | ✅ Sí |
| Código del frontend | ✅ Sí | ✅ Sí | ✅ Sí |
| Dockerfile del backend | ✅ Sí | ✅ Sí | ✅ Sí |
| Dockerfile del frontend | ✅ Sí | ✅ Sí | ✅ Sí |
| docker-compose.yml | ✅ Sí | ❌ No* | ✅ Sí |
| Dependencias (requirements.txt, package.json) | ✅ Sí | ✅ Sí | ✅ Sí |

\* *Si solo cambias configuración (puertos, volúmenes), no necesitas reconstruir, solo reiniciar*

---

## Casos Específicos

### 1. Configurar Nginx (Este caso)

**Cambios:** `nginx/nginx-server.conf`, `scripts/setup-nginx.sh`

**Acción:**
```bash
git pull origin main
sudo ./scripts/setup-nginx.sh
# NO necesitas parar/reconstruir contenedores
```

**Razón:** Nginx corre en el sistema operativo, no en Docker. Los contenedores siguen funcionando normalmente.

---

### 2. Cambiar Variables de Entorno

**Cambios:** `.env` (backend o frontend)

**Acción:**
```bash
# Editar .env
nano acbc_app/.env

# Reiniciar contenedor para cargar nuevas variables backend
docker compose restart backend

# Si cambiaste VITE_API_URL en deploy normal:
# 1. Actualiza la GitHub Repository variable VITE_API_URL
# 2. Espera a que GitHub Actions publique la nueva imagen frontend
./scripts/deploy.sh
```

**Razón:** Los contenedores necesitan reiniciarse para leer las nuevas variables de entorno.

---

### 3. Cambiar Código de la Aplicación

**Cambios:** Código Python (backend) o React (frontend)

**Acción:**
```bash
git pull origin main

# Deploy normal: pull de imágenes GHCR y up
./scripts/deploy.sh

# Build manual/local en el servidor solo si lo necesitas
./scripts/deploy.sh --build-local
```

**Razón:** El código está dentro de la imagen Docker. En producción, GitHub Actions reconstruye y publica la imagen; el servidor la descarga.

---

### 4. Cambiar Dependencias

**Cambios:** `requirements.txt` o `package.json`

**Acción:**
```bash
git pull origin main

# Deploy normal: GitHub Actions reconstruye y publica; el servidor descarga
./scripts/deploy.sh

# Build manual/local en el servidor solo si lo necesitas
./scripts/deploy.sh --build-local
```

**Razón:** Las dependencias se instalan durante el build. Necesitas reconstruir.

---

### 5. Cambiar docker-compose.yml

**Cambios:** Puertos, volúmenes, variables de entorno en docker-compose.yml

**Acción:**
```bash
git pull origin main

# Si solo cambias configuración (no Dockerfiles)
docker compose down
docker compose up -d

# Si cambias Dockerfiles también, deploy normal:
./scripts/deploy.sh

# Build manual/local en el servidor solo si lo necesitas:
./scripts/deploy.sh --build-local
```

**Razón:** Docker Compose necesita recrear los contenedores con la nueva configuración.

---

## Para el Caso Actual (Nginx)

**NO necesitas parar contenedores porque:**

1. ✅ Los contenedores siguen corriendo normalmente
2. ✅ Nginx se configura en el sistema, no en Docker
3. ✅ El script `setup-nginx.sh` solo modifica archivos del sistema
4. ✅ Los contenedores no se ven afectados

**Flujo completo:**

```bash
# 1. Pull de cambios
git pull origin main

# 2. Configurar Nginx (NO afecta contenedores)
sudo ./scripts/setup-nginx.sh

# 3. Actualizar VITE_API_URL en GitHub Repository variables
# Cambiar a: VITE_API_URL=http://159.65.69.165/api

# 4. Esperar nueva imagen GHCR y desplegar
./scripts/deploy.sh

# 5. Verificar
curl http://159.65.69.165/api/health/
```

---

## Comandos Útiles

### Ver estado de contenedores
```bash
docker compose ps
```

### Ver logs sin parar
```bash
docker compose logs -f
```

### Reiniciar sin reconstruir
```bash
docker compose restart [service]
```

### Reconstruir y reiniciar manualmente
```bash
./scripts/deploy.sh --build-local
```

### Parar todo
```bash
docker compose down
```

### Parar y eliminar volúmenes (⚠️ CUIDADO: borra datos)
```bash
docker compose down -v
```

---

## Regla General

**Si el cambio está:**
- **Fuera de Docker** (sistema, Nginx, scripts) → NO parar contenedores
- **Dentro de Docker** (código, dependencias, Dockerfiles) → GitHub Actions reconstruye; el servidor hace pull con `./scripts/deploy.sh`

**Para este caso específico (Nginx):** NO necesitas parar nada. Solo ejecutar el script y actualizar variables.
