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

## Deploy normal desde GHCR

En el servidor:

```bash
cd /opt/acbc-app
git pull origin main
./scripts/deploy.sh
```

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

Para desplegar un commit específico:

```bash
IMAGE_TAG=sha-<commit-sha> ./scripts/deploy.sh
```

Si las imágenes son privadas, autentica el servidor una vez:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin
```

El token necesita permiso `read:packages`.

## Deploy con build manual/local

Usa este método solo si necesitas construir en el servidor de forma intencional, por ejemplo para probar cambios de Dockerfile antes de que GitHub Actions publique la imagen.

```bash
cd /opt/acbc-app
git pull origin main
./scripts/deploy.sh --build-local
```

Para una reconstrucción limpia sin cache:

```bash
./scripts/deploy.sh --build-local --no-cache
```

El build manual usa `docker-compose.build.yml` como override. Ese archivo agrega los bloques `build:` que ya no existen en `docker-compose.prod.yml`.

Importante:

- El deploy normal no usa `docker-compose.build.yml`.
- Para el frontend, asegúrate de tener `VITE_API_URL` y `VITE_GOOGLE_OAUTH_CLIENT_ID` en el root `.env` o exportadas en el shell antes de `--build-local`.
- Las imágenes locales quedan etiquetadas con el mismo nombre que usa producción, por ejemplo `ghcr.io/<owner>/<repo>-frontend:main`, pero no se publican en GHCR.
