# Settings Security Checklist (Production)

Use this checklist when deploying or auditing Django settings for production.

## Environment and secrets

- [ ] `ENVIRONMENT=PRODUCTION`
- [ ] `DEBUG=False` (validated at startup in production)
- [ ] `ACADEMIA_BLOCKCHAIN_SKEY` set to a generated secret (not the default)
- [ ] `ALLOWED_HOSTS` set (comma-separated); required in production
- [ ] No secrets, DSNs, or passwords in code or versioned `.env`

## CORS and CSRF

- [ ] `CORS_ALLOW_ALL_ORIGINS` is `False` (never use Allow All in production)
- [ ] `CORS_ALLOWED_ORIGINS` includes only real frontend origins (plus optional `CORS_ALLOWED_ORIGINS` env)
- [ ] `CSRF_TRUSTED_ORIGINS` aligned with actual domains (include `https://` where used)
- [ ] `CSRF_COOKIE_SAMESITE` / `SESSION_COOKIE_SAMESITE` appropriate for your auth flow (e.g. `Lax`)

## JWT and cookies

- [ ] `USE_HTTPS=true` in production when serving over HTTPS
- [ ] `JWT_AUTH_SECURE` / `AUTH_COOKIE_SECURE` true in production (derived from `USE_HTTPS`)
- [ ] `ACCESS_TOKEN_LIFETIME` and `REFRESH_TOKEN_LIFETIME` match your session policy

## REST Framework

- [ ] `DEFAULT_PERMISSION_CLASSES` set (e.g. `IsAuthenticated`); public views use `AllowAny` or `permission_classes = []` explicitly
- [ ] Pagination and error handling consistent across API

## Other

- [ ] `SETTINGS_EXPORT` contains only non-sensitive keys (e.g. `CSRF_COOKIE_NAME`)
- [ ] `SECURE_CROSS_ORIGIN_OPENER_POLICY` documented if set to `None` (e.g. for OAuth popups)

## Recommended changes (from audit)

1. Use explicit CORS origins; disable `CORS_ALLOW_ALL_ORIGINS` in all environments.
2. Enable secure cookies in production via `USE_HTTPS=true` when using HTTPS.
3. Set `DEFAULT_PERMISSION_CLASSES` to `IsAuthenticated`; keep public endpoints explicitly `AllowAny` or `[]`.
4. Extend origins via `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` (env or config) as needed for production domains.
