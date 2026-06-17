# Deploy con imágenes preconstruidas en GHCR

Producción ya no construye imágenes durante el deploy normal. GitHub Actions construye y publica las imágenes en GitHub Container Registry (GHCR), y el servidor solo hace `docker compose pull` + `up -d`.

## Imágenes publicadas

El workflow `.github/workflows/deploy.yml` publica estas imágenes después de que pasan los tests en `main`:

```text
ghcr.io/<owner>/<repo>-backend:main
ghcr.io/<owner>/<repo>-frontend:main
ghcr.io/<owner>/<repo>-nginx:main
```

También publica tags por commit con formato:

```text
sha-<commit-sha>
```

El frontend necesita las variables de GitHub Actions:

```text
VITE_API_URL
VITE_GOOGLE_OAUTH_CLIENT_ID
```

Configúralas como **Repository variables** en GitHub, porque Vite las inyecta en build time.

## Deploy normal desde GHCR (servidor de producción)

En el droplet con poca RAM, **solo** este flujo:

```bash
cd /opt/acbc-app
git pull origin main
./scripts/deploy.sh --wait-for-ci
```

`--wait-for-ci` hace `docker pull` del frontend en GHCR cada ~90s hasta que `.build_sha` dentro de la imagen coincide con `git rev-parse HEAD`. No compila nada en el servidor.

**No uses `--build-local` en producción** si el build de frontend se queda sin memoria (~3GB+ libres para `npm run build`). GitHub Actions construye las imágenes en runners con RAM suficiente.

**Importante:** `git pull` actualiza el repo en el servidor, pero la app corre desde **imágenes Docker en GHCR**. Si despliegas antes de que CI publique la imagen, o usas `--build-local-backend`, el frontend puede quedarse viejo.

El script detecta `GHCR_IMAGE_PREFIX` desde el remote de Git. Para este repo el formato esperado es:

```bash
GHCR_IMAGE_PREFIX=ghcr.io/<owner>/<repo>
```

Con ese prefijo, `docker-compose.prod.yml` usa:

```text
${GHCR_IMAGE_PREFIX}-backend:${IMAGE_TAG:-main}
${GHCR_IMAGE_PREFIX}-frontend:${IMAGE_TAG:-main}
${GHCR_IMAGE_PREFIX}-nginx:${IMAGE_TAG:-main}
```

Si quieres fijarlo explícitamente:

```bash
GHCR_IMAGE_PREFIX=ghcr.io/<owner>/<repo> IMAGE_TAG=main ./scripts/deploy.sh
```

Para desplegar un commit específico (tag inmutable publicado por CI; formato `sha-` + SHA largo o SHA largo según metadata-action):

```bash
IMAGE_TAG=sha-<commit-sha-completo> ./scripts/deploy.sh
# o, si CI publicó solo el SHA largo:
IMAGE_TAG=<commit-sha-completo> ./scripts/deploy.sh
```

Si el deploy falla por imagen desactualizada pero quieres continuar igual:

```bash
./scripts/deploy.sh --allow-stale-images
```

Si las imágenes son privadas, autentica el servidor una vez:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin
```

El token necesita permiso `read:packages`.

## Deploy con build manual/local

Solo en una máquina con **~3GB+ RAM libre** (no el droplet de producción típico de 1–2GB):

```bash
./scripts/deploy.sh --build-local
```

En el servidor de producción usa siempre GHCR + `--wait-for-ci`.

El build manual usa `docker-compose.build.yml` como override. Ese archivo agrega los bloques `build:` que ya no existen en `docker-compose.prod.yml`.

Importante:

- El deploy normal no usa `docker-compose.build.yml`.
- Para el frontend, asegúrate de tener `VITE_API_URL` y `VITE_GOOGLE_OAUTH_CLIENT_ID` en el root `.env` o exportadas en el shell antes de `--build-local`.
- Las imágenes locales quedan etiquetadas con el mismo nombre que usa producción, por ejemplo `ghcr.io/<owner>/<repo>-frontend:main`, pero no se publican en GHCR.
