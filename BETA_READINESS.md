# Checklist pre-beta

Revisar antes de abrir el beta a testers.

## 1. Sentry (errores backend y frontend)

- [ ] **Backend:** Crear proyecto en [sentry.io](https://sentry.io), copiar el DSN y añadir en `acbc_app/.env`:
  - `SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx`
  - Opcional: `SENTRY_TRACES_SAMPLE_RATE=0.2` para más transacciones en beta.
- [ ] **Frontend:** En el mismo proyecto (o uno para “frontend”) copiar DSN y añadir en `frontend/.env`:
  - `VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx`
- [ ] Reconstruir y desplegar. Verificar en Sentry que lleguen eventos (por ejemplo provocando un error de prueba).

## 2. Entorno y despliegue

- [ ] `ENVIRONMENT=PRODUCTION` (o el valor que use el beta).
- [ ] `ALLOWED_HOSTS` incluye el dominio de la beta.
- [ ] `DEBUG=False`.
- [ ] Si el frontend apunta a la API de beta: `VITE_API_URL` con la URL correcta en el build.

## 3. Salud del servicio

- [ ] `GET /health/` responde 200. Usar como liveness en el servidor/load balancer si aplica.

## 4. Feedback de testers

- [ ] Formulario o canal para reportar bugs (email, Typeform, GitHub Issues, etc.).
- [ ] Enlace en la app o en el email de invitación al beta (por ejemplo en `BETA_TESTING.md` o en la propia UI).

## 5. Recomendaciones adicionales

- **Backups:** Si el beta usa base de datos real, tener backups automáticos (p. ej. cron con `scripts/backup-db.sh`).
- **Usuarios de prueba:** Crear 1–2 cuentas de prueba y comprobar flujos críticos (login, una ruta, un comentario, gamificación) antes de invitar a testers.
- **Documentación para testers:** Tener listo y accesible `BETA_TESTING.md` (o equivalente) con las acciones recomendadas.
