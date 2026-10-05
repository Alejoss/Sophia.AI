# Nginx routes and configuration

## Which config file to use

| File | Use case |
|------|----------|
| **nginx/nginx.conf** | Docker Compose with Nginx container (`docker-compose.prod.yml`). Upstreams: `backend:8000`, `frontend:80`. |
| **nginx/nginx-server.conf** | Nginx on host (e.g. bare metal / VM). Upstreams: `localhost:8000`. |

Copy the appropriate file to `/etc/nginx/sites-available` (or `conf.d`) and enable it. Do not mix: Docker compose uses the containerized Nginx with `nginx.conf`.

## Route diagram (Docker Compose / nginx.conf)

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                      NGINX                               │
                    └─────────────────────────────────────────────────────────┘
                                          │
         ┌────────────────────────────────┼────────────────────────────────┐
         │                                │                                │
         ▼                                ▼                                ▼
  ┌──────────────┐              ┌──────────────────┐              ┌──────────────┐
  │ /health/     │              │ /api/            │              │ /            │
  │ → backend    │              │ /admin/          │              │ → frontend   │
  │   /health/   │              │ /static/         │              │   (React)    │
  │   (JSON)     │              │ /media/          │              └──────────────┘
  └──────────────┘              │ → backend        │
                                └──────────────────┘
         │
         ▼
  ┌──────────────┐
  │ /health      │  (exact, no trailing slash)
  │ → 200        │  nginx-only; no backend proxy
  │   "healthy"  │
  └──────────────┘
```

- **`/health/`**: Proxied to Django `GET /health/`. Returns `{"status":"healthy","service":"academia_blockchain"}`. Use for backend readiness.
- **`/health`**: Nginx returns `200 "healthy"` (no backend). Use for simple load-balancer checks.
- **`/api/`**, **`/admin/`**, **`/static/`**, **`/media/`**: Proxied to backend.
- **`/content/<id>/…`** and **`/content/topics/<id>/…`**: For normal browsers, proxied to the frontend SPA. For social crawlers (TelegramBot, facebookexternalhit, Twitterbot, Slackbot, Discordbot, WhatsApp, etc.), nginx rewrites to Django Open Graph HTML at `/api/content/social-preview/<id>/` or `/api/content/topics/social-preview/<id>/` so link previews get `og:title` / `og:image` without executing React.
- **`/`**: Proxied to frontend (React).

## SSL (Let’s Encrypt)

- `nginx.conf` references `/etc/letsencrypt/live/yourdomain.com/`. Replace `yourdomain.com` with your domain.
- Obtain certs with Certbot, e.g.:
  ```bash
  certbot certonly --webroot -w /var/www/certbot -d yourdomain.com
  ```
- Mount `certbot_data` and `certbot_certs` as in `docker-compose.prod.yml`. See [setup-ssl.sh](../../scripts/setup-ssl.sh) and deployment docs.

## Canonical host (www vs apex)

`www.example.com` and `example.com` are **different browser origins** (separate cookies and `localStorage`). Auth must use a single canonical URL.

**Standard fix:** 301 redirect apex → `www` at nginx or Cloudflare. Do **not** handle this in React.

- **Docker / setup-ssl:** `nginx/nginx-ssl.conf.template` defines:
  - HTTP → `https://www…`
  - HTTPS apex → `https://www…`
  - HTTPS `www` → app (only server block that proxies)
- Regenerate after template changes:
  ```bash
  ./scripts/setup-ssl.sh www.academiablockchain.com
  # or ./scripts/setup-ssl.sh academiablockchain.com  (script adds www SAN + redirect)
  ```
- **Backend `.env`:** use the canonical URL only:
  ```env
  ALLOWED_HOSTS=academiablockchain.com,www.academiablockchain.com
  FRONTEND_PUBLIC_URL=https://www.academiablockchain.com
  CSRF_TRUSTED_ORIGINS=https://www.academiablockchain.com
  ```
- **Cloudflare (if proxy is orange-cloud):** Rules → Redirect Rule:
  - If hostname equals `academiablockchain.com`
  - Then static redirect to `https://www.academiablockchain.com${http.request.uri.path}` (301)

If production already has `nginx/nginx-ssl.conf` (gitignored), re-run `setup-ssl.sh` or manually add the apex `server { return 301 … }` block from the template.

## Timeouts

- `/api/`: `proxy_connect_timeout`, `proxy_send_timeout`, `proxy_read_timeout` = 120s for long-running requests (e.g. uploads). Adjust if needed.

## Changes from audit

1. **`/health/` → backend**: Added `location /health/` to proxy to Django. Previously only `/health` (static) existed; `/health/` fell through to frontend and 404’d.
2. **SSL paths**: Comment updated to clarify replacing `yourdomain.com` and using Certbot.
