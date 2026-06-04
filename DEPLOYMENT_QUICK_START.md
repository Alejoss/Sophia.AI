# Production Deployment Quick Start

## Quick Checklist

### Before Deployment

- Set `ENVIRONMENT=PRODUCTION` in `acbc_app/.env`
- Set `DEBUG=False` in `acbc_app/.env`
- Set `ALLOWED_HOSTS` to your domain(s) in `acbc_app/.env`
- Generate and set secure `ACADEMIA_BLOCKCHAIN_SKEY`
- Configure database credentials in `acbc_app/.env`:
  - Set `POSTGRES_DB` (or `DB_NAME`), `POSTGRES_USER` (or `DB_USER`), `POSTGRES_PASSWORD` (or `DB_PASSWORD`)
  - **Recommended**: Use passwords without special characters that cause issues (`$`, `!`, `%`, ```). Safe characters: letters, numbers, `-`, `_`, `.`, `@`, `#`
- Set up Google OAuth credentials (if using)
- Configure frontend `.env` with production API URL
- **Email:** Leave `SEND_EMAILS` unset (or `false`) until Postmark is approved; then set `SEND_EMAILS=true` and `POSTMARK_SERVER_TOKEN` in `acbc_app/.env`. See [Email features](docs/deployment/email-features.md).

### Deployment Steps

1. **Connect to the server (Digital Ocean droplet):**
  ```bash
   ssh root@159.65.69.165
  ```
   Then go to the app directory:
  ```bash
   cd /opt/acbc-app
  ```
   **First-time on this server?** Run once so `git pull` is not blocked by script permissions:
   (The server should not have local commits; this makes Git ignore executable-bit changes from `chmod +x`.)
   **If `./scripts/deploy.sh` says "Permission denied" after a pull:** Git stores scripts as non-executable (100644), so each pull resets permissions. Either run `chmod +x scripts/deploy.sh scripts/setup-nginx.sh acbc_app/entrypoint.sh` after each pull, or fix it once in the repo (see [Scripts README](scripts/README.md#fix-permissions-permanently-in-the-repo)).
2. **Pull prebuilt images and deploy (recommended):**
  ```bash
   cd /opt/acbc-app
   git pull origin main
   ./scripts/deploy.sh
  ```
   The script reads DB credentials from `acbc_app/.env`, detects `GHCR_IMAGE_PREFIX` from the GitHub remote, pulls prebuilt images from GHCR, frees port 80 if host nginx/apache is using it, then starts the stack.
   It runs in non-interactive mode (no "press Enter" prompt).
   If GHCR images are private, log in on the server once with a token that has `read:packages`:
  ```bash
   echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin
  ```
   **Fast path (alias):** `./scripts/deploy-light.sh` is the same as `./scripts/deploy.sh` (pull GHCR, then rolling `up --force-recreate` without a full `down`). Use `--full-down` only if you need a full stop before start.
   **Backend-only local build (API/Python changes; usually a few minutes):**
  ```bash
   ./scripts/deploy.sh --build-local-backend
  ```
   **Full local build (backend + frontend + nginx; can take 30–60+ minutes):**
  ```bash
   ./scripts/deploy.sh --build-local
   ./scripts/deploy.sh --build-local --no-cache   # clean rebuild
  ```
   Do not use `--build-local` for small backend-only changes.
   See [Deploy con imágenes preconstruidas en GHCR](docs/deployment/ghcr-image-deploy.md) for the full image/tag and manual build workflow.
3. **Point a custom domain (Namecheap + app config):**
  See [Custom domain (Namecheap + Digital Ocean)](#custom-domain-namecheap--digital-ocean) below.
4. **Set up SSL (after DNS is configured):**
  Certificates come from **Let's Encrypt** (free, via certbot). The script writes only to **nginx/nginx-ssl.conf** (gitignored), so **the repo is not modified**. To avoid rebuilding twice (once for ALLOWED_HOSTS, once for SSL), set `ALLOWED_HOSTS` in `acbc_app/.env` first, then run setup-ssl, then deploy once:
   Certs live on the host at `/etc/letsencrypt`; nginx uses them via bind mount. Renewal is via crontab (certbot renew).
5. **Create admin user:**
  ```bash
   docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
  ```
6. **Set up automated backups:**
  ```bash
   # Add to crontab
   (crontab -l 2>/dev/null; echo "0 2 * * * cd $(pwd) && ./scripts/backup-db.sh") | crontab -
  ```
7. **Large file uploads (videos, etc.):** The stack allows uploads up to 5 GB (nginx `client_max_body_size`, Django limits, and longer timeouts). If you use **HTTPS with a generated `nginx-ssl.conf`**, re-run `./scripts/setup-ssl.sh yourdomain.com` after pulling config changes so the generated file includes the larger body size; then restart: `docker compose -f docker-compose.prod.yml restart nginx`.
8. **S3 media (profile pictures, uploads) and 404s:** In production, media is served from **AWS S3**. Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and optionally `AWS_STORAGE_BUCKET_NAME` in `acbc_app/.env`.
  - **Bucket permissions:** The bucket must allow public read for images to load in the browser. In AWS S3 → your bucket → **Permissions**: either turn off **Block Public Access** for “Block public access to buckets and objects granted through new access control lists (ACLs)” so that `public-read` ACL works, or add a **bucket policy** (S3 → bucket → Permissions → Bucket policy → Edit). Example — replace `academiablockchain` with your bucket name:
   This allows public read for all objects. To limit to media only, use `"Resource": "arn:aws:s3:::academiablockchain/profile_pictures/*"` and add a second statement for `files/`*.  
  - **Existing media 404:** Profile pictures and other files uploaded **before** S3 was enabled were stored on the server’s media volume only; they were never uploaded to S3. The app now generates S3 URLs for those paths, so the browser gets 404 until the files exist in S3. Fix by either: (a) re-uploading profile pictures in the app (edit profile → change picture), or (b) copying existing files from the server’s media directory into S3 with the same keys (e.g. `profile_pictures/Username_Feb-09-26.jpeg`). New uploads go to S3 and will work once the bucket allows public read.

### Custom domain (Namecheap + Digital Ocean)

To serve the app at a custom URL (e.g. `https://academia.yourdomain.com`):

**1. Namecheap – DNS**

- Log in to [Namecheap](https://www.namecheap.com) → Domain List → Manage for your domain.
- Go to **Advanced DNS**.
- Add or edit records so the hostname points to your droplet’s **public IP** (e.g. `159.65.69.165`):

  | Type  | Host  | Value             | TTL                |
  | ----- | ----- | ----------------- | ------------------ |
  | **A** | `@`   | `YOUR_DROPLET_IP` | Automatic (or 300) |
  | **A** | `www` | `YOUR_DROPLET_IP` | Automatic (or 300) |

  For a subdomain (e.g. `academia.yourdomain.com`):

  | Type  | Host       | Value             | TTL                |
  | ----- | ---------- | ----------------- | ------------------ |
  | **A** | `academia` | `YOUR_DROPLET_IP` | Automatic (or 300) |

- Remove any conflicting **URL Redirect** or **CNAME** for the same host if you want the droplet to serve the site.
- Save. DNS can take from a few minutes up to 24–48 hours to propagate.

**2. Digital Ocean**

- No extra configuration is required for the droplet to accept the domain: it listens on ports 80/443 and your nginx uses `server_name _`, so it accepts any hostname.
- Optional: in the DO dashboard you can add the domain under the droplet or in **Networking → Domains** for documentation only; it does not change how traffic is routed (DNS at Namecheap does).

**3. App configuration (on the server)**

- In `acbc_app/.env` on the droplet, set **ALLOWED_HOSTS** to your domain(s) (comma-separated, no spaces). Example for `academia.yourdomain.com` and `www.academia.yourdomain.com`:
  ```env
  ALLOWED_HOSTS=academia.yourdomain.com,www.academia.yourdomain.com,159.65.69.165
  ```
  Keep the droplet IP if you still want to open the app by IP. Then restart the backend so the change is applied:
  ```bash
  docker compose -f docker-compose.prod.yml restart backend
  ```

**4. HTTPS (recommended)**

- Certificates are from **Let's Encrypt** (free; [https://letsencrypt.org](https://letsencrypt.org)). The script **does not change any tracked file**: it generates **nginx/nginx-ssl.conf** (gitignored) on the server.
- The certificate includes SANs for the hostname passed plus related apex/`www` variant (e.g., passing `yourdomain.com` includes `www.yourdomain.com`; passing `www.yourdomain.com` includes `yourdomain.com`).
- After DNS points to the droplet, set **ALLOWED_HOSTS** in `acbc_app/.env`, then run setup-ssl, then deploy once (one rebuild):
  ```bash
  ./scripts/setup-ssl.sh academia.yourdomain.com
  ./scripts/deploy.sh
  ```
  Use the exact hostname you use in the browser. Renewal is automatic (crontab runs certbot renew).

**Quick check**

- From your machine: `ping academia.yourdomain.com` (or your host) — should resolve to the droplet IP.
- Then open `http://academia.yourdomain.com` (or your host); after SSL, `https://academia.yourdomain.com`.

### Common Commands

Run these from the project root (e.g. `cd /opt/acbc-app`). After a deploy, the script prints the exact commands with full paths so you can run them from any directory.

**View logs (all services, follow mode; press Ctrl+C to exit):**

```bash
docker compose --env-file .env.compose -f docker-compose.prod.yml logs -f
```

**View logs for a single service:**

```bash
docker compose --env-file .env.compose -f docker-compose.prod.yml logs -f backend
docker compose --env-file .env.compose -f docker-compose.prod.yml logs -f frontend
docker compose --env-file .env.compose -f docker-compose.prod.yml logs -f nginx
docker compose --env-file .env.compose -f docker-compose.prod.yml logs -f postgres
```

**Other commands:**

```bash
# Restart services
docker compose --env-file .env.compose -f docker-compose.prod.yml restart

# Stop services
docker compose --env-file .env.compose -f docker-compose.prod.yml down

# Backup database
./scripts/backup-db.sh

# Update application by pulling prebuilt GHCR images
git pull origin main && ./scripts/deploy.sh

# Intentional server-side rebuild, only when needed
./scripts/deploy.sh --build-local
```

**Django management commands (production):**

Run from the project root after `./scripts/deploy.sh` (`.env.compose` is created by the deploy script). Use the same pattern as local dev, but with `docker compose`, `docker-compose.prod.yml`, and `--env-file .env.compose`:

```bash
docker compose --env-file .env.compose -f docker-compose.prod.yml exec backend python manage.py <command>
```

**Topic listing thumbnails** — backfill `topic_image_thumbnail` from existing cover images (`topic_image`). Run once after deploying code that adds thumbnails, or with `--force` to regenerate all:

```bash
# All topics with a cover image (skips topics that already have a thumbnail)
docker compose --env-file .env.compose -f docker-compose.prod.yml exec backend python manage.py generate_topic_thumbnails

# One topic only
docker compose --env-file .env.compose -f docker-compose.prod.yml exec backend python manage.py generate_topic_thumbnails --topic-id=3

# Regenerate even when a thumbnail already exists
docker compose --env-file .env.compose -f docker-compose.prod.yml exec backend python manage.py generate_topic_thumbnails --force
```

Local equivalent (dev stack):

```bash
docker-compose exec backend python manage.py generate_topic_thumbnails
```

### Health Checks

**Script (on server):**

```bash
./scripts/health-check.sh
```

**Manual:**

- Backend: `http://yourdomain.com/health/` (or `http://YOUR_IP/health/`)
- Frontend: `http://yourdomain.com/health` (or `http://YOUR_IP/health`)

**Note:** The default `nginx/nginx.conf` serves over HTTP (port 80). For HTTPS, run `./scripts/setup-ssl.sh yourdomain.com`; it generates `nginx/nginx-ssl.conf` (gitignored) and uses Let's Encrypt certs from the host.

### Important Files

- Production compose: `docker-compose.prod.yml`
- Manual build override: `docker-compose.build.yml` (only used by `./scripts/deploy.sh --build-local`)
- Backend env: `acbc_app/.env` (main configuration)
- Root `.env`: Optional (e.g. `IMAGE_TAG`, `GHCR_IMAGE_PREFIX`, or `VITE_`* for manual local builds); deploy script uses `acbc_app/.env` and creates `.env.compose` for Docker Compose substitution
- Frontend env: `frontend/.env`
- Nginx config: `nginx/nginx.conf` (HTTP); after SSL, deploy uses `nginx/nginx-ssl.conf` (generated, gitignored)

**Note**: `./scripts/deploy.sh` builds `.env.compose` from `acbc_app/.env` (DB_NAME, DB_USER, DB_PASSWORD) and image metadata (`GHCR_IMAGE_PREFIX`, `IMAGE_TAG`). It also stops host nginx/apache if port 80 is in use so the container nginx can bind.

### Troubleshooting

`**git pull` says "Your local changes would be overwritten" (only file mode changes):**

```bash
git config core.fileMode false
git status   # scripts should no longer appear as modified
git pull origin main
chmod +x scripts/deploy.sh scripts/setup-nginx.sh acbc_app/entrypoint.sh  # if needed
```

**Services won't start:**

```bash
docker compose --env-file .env.compose -f docker-compose.prod.yml logs -f   # see logs (Ctrl+C to exit)
docker compose --env-file .env.compose -f docker-compose.prod.yml ps       # see container status
```

(From project root. Or use the exact command printed at the end of `./scripts/deploy.sh`, which uses full paths.)

**Database issues:**

```bash
docker compose --env-file .env.compose -f docker-compose.prod.yml exec postgres psql -U postgres -d academiablockchain_prod
```

**Static files not loading:**

```bash
docker compose --env-file .env.compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
```

For detailed instructions, see [Digital Ocean Deployment Guide](docs/deployment/digital-ocean.md).