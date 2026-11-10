# Postgres container unhealthy (Cloudflare 521)

Use this when `academiablockchain.com` shows Cloudflare **521** and `docker compose up` reports:

```text
dependency failed to start: container acbc_postgres_prod is unhealthy
```

The database files are still in the Docker volume `postgres_data`. That volume is not recreated by `up`. The deploy that failed only created the new log volumes (`acbc_prod_backend_logs`, `acbc_prod_nginx_logs`, `acbc_prod_frontend_logs`, and, on the broken release, `acbc_prod_postgres_logs`).

Do not run `docker compose down -v`. The `-v` flag deletes `postgres_data`.

## What broke

`docker-compose.prod.yml` replaced the official `postgres:15` entrypoint with `scripts/docker/postgres-entrypoint.sh`. That script teed stderr into `/var/log/postgresql/postgresql.log` and then became PID 1 in front of Postgres. The container exited before `pg_isready` succeeded, so Compose refused to start the backend. Nginx then had nothing to proxy, and Cloudflare returned 521.

The image entrypoint must stay the one shipped in `postgres:15`. Postgres output for the running container is `docker compose logs postgres`. That stream is deleted the next time the container is recreated. Do not wrap the entrypoint to keep a copy.

## Restore the site

On the droplet, from the checkout (usually `/opt/acbc-app`):

```bash
cd /opt/acbc-app
git pull origin develop
docker compose --env-file .env.compose -f docker-compose.prod.yml up -d
docker compose --env-file .env.compose -f docker-compose.prod.yml ps
```

Postgres should become healthy, then the backend health check should pass. Confirm the origin is serving:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/health/
docker compose --env-file .env.compose -f docker-compose.prod.yml logs --tail=40 postgres
```

A ready server logs `database system is ready to accept connections`.

## If the pull is not on the server yet

Edit `docker-compose.prod.yml` and delete only these lines from the `postgres` service, if they are present:

```yaml
      - postgres_logs:/var/log/postgresql
      - ./scripts/docker/postgres-entrypoint.sh:/usr/local/bin/acbc-postgres-entrypoint.sh:ro
    entrypoint: ["/bin/bash", "/usr/local/bin/acbc-postgres-entrypoint.sh"]
```

Also delete the `postgres_logs:` volume entry at the bottom of the file if it is there. Leave `postgres_data` mounted at `/var/lib/postgresql/data`. Then:

```bash
docker compose --env-file .env.compose -f docker-compose.prod.yml up -d
```

After `develop` contains this fix, `git pull` may need a stash or a checkout of that file if it was edited by hand.

## What to read next

Application and nginx history still survives recreate. The map is in [logging-and-observability.md](../backend/logging-and-observability.md).
