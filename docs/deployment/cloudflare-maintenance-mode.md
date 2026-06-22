# Cloudflare — Modo mantenimiento

Durante cambios de infraestructura (SSL, nginx, certbot, deploy con downtime), el sitio en producción puede mostrar una **página de mantenimiento** configurada en **Cloudflare**, sin tocar el código de la app.

## Qué está configurado

En el dashboard de Cloudflare para `academiablockchain.com`:

| Campo | Valor |
|-------|--------|
| Tipo | **Redirect Rule** (Rules → Overview) |
| Nombre | `maintainance-mode` |
| Match | All incoming requests |
| Action | **302** → `https://acbc-mantenimiento.alejoveintimilla.workers.dev/` |
| Worker | Página estática en Cloudflare Workers (cuenta externa al repo) |

Esto es **independiente** de la ruta `/mantenimiento` de la app React (`frontend/src/generalComponents/Maintenance.jsx`), que solo se ve si nginx sirve el frontend.

## Activar / desactivar

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **academiablockchain.com**
2. Menú izquierdo → **Rules** → **Overview** (Redirect Rules)
3. Regla **`maintainance-mode`**
4. Toggle **Status**:
   - **Enabled** → todo el tráfico público va a la página de mantenimiento
   - **Disabled** → tráfico normal al droplet

Los cambios aplican en segundos. No requiere `git pull` ni `./scripts/deploy.sh`.

## Cuándo usarlo

- Renovar o ampliar certificados (`./scripts/setup-ssl.sh`)
- Regenerar `nginx/nginx-ssl.conf` (redirect apex → www)
- Deploy con riesgo de downtime
- Migraciones o cambios que dejen nginx/backend caídos unos minutos

## Flujo recomendado (infra / SSL)

```text
1. Cloudflare → activar maintainance-mode
2. SSH al servidor → git pull
3. (Opcional) Desactivar maintainance-mode 1–2 min solo durante certbot — ver nota abajo
4. ./scripts/setup-ssl.sh www.academiablockchain.com admin@academiablockchain.com
5. Verificar redirect y health checks
6. Cloudflare → desactivar maintainance-mode
```

### Variables `.env` (canonical www)

Tras fijar `www` como URL canónica:

```env
ALLOWED_HOSTS=academiablockchain.com,www.academiablockchain.com
FRONTEND_PUBLIC_URL=https://www.academiablockchain.com
ACADEMIA_PUBLIC_URL=https://www.academiablockchain.com
CSRF_TRUSTED_ORIGINS=https://www.academiablockchain.com
```

Ver también [nginx-routes.md — Canonical host](nginx-routes.md#canonical-host-www-vs-apex).

## Certbot y la regla de mantenimiento

Let's Encrypt valida dominios por HTTP (`/.well-known/acme-challenge/...`). Si el DNS está en **proxy naranja** y la regla redirige **all incoming requests**, certbot puede **fallar** porque Cloudflare responde 302 al Worker en lugar de dejar pasar el challenge.

**Opciones:**

| Opción | Cuándo |
|--------|--------|
| **A. Desactivar maintainance-mode** solo mientras corre certbot (1–2 min) | Más simple; nginx ya estará parado |
| **B. Regla de excepción** con prioridad **antes** que maintainance-mode: If URI Path starts with `/.well-known/acme-challenge/` → Skip | Mantenimiento activo para usuarios; certbot funciona |
| **C. DNS challenge** (`certbot certonly --dns-cloudflare ...`) | Avanzado; requiere API token |

## Orden de reglas en Cloudflare

Cuando el mantenimiento está **desactivado**, conviene una regla adicional (opcional en Cloudflare o en nginx):

- **If** Hostname equals `academiablockchain.com`
- **Then** 301 → `https://www.academiablockchain.com${http.request.uri.path}`

Orden sugerido:

1. Excepción ACME (si aplica)
2. `maintainance-mode` (solo cuando Enabled)
3. Apex → www (cuando mantenimiento Disabled)

En el droplet, el template `nginx/nginx-ssl.conf.template` ya hace redirect apex → www si regenerás SSL con `setup-ssl.sh`.

## Verificación

Con mantenimiento **activado**:

```bash
curl -I https://www.academiablockchain.com/
# Esperado: 302 Location: https://acbc-mantenimiento.alejoveintimilla.workers.dev/
```

Con mantenimiento **desactivado** y SSL/nginx aplicados:

```bash
curl -I https://academiablockchain.com/events/2
# Esperado: 301 Location: https://www.academiablockchain.com/events/2
```

## Relacionado

- [nginx-routes.md](nginx-routes.md) — redirect canónico y SSL
- [deployment-checklist.md](deployment-checklist.md) — checklist de producción
- [DEPLOYMENT_QUICK_START.md](../../DEPLOYMENT_QUICK_START.md) — comandos en el servidor
