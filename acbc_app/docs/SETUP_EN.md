# Development Environment Setup

The application runs in **Docker**. You do not install Python or Node on your host machine for normal development; you use Docker and run all backend/frontend commands inside the containers.

---

## Prerequisites

- **Git** — [Download](https://git-scm.com/downloads)
- **Docker** — [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

Check that Docker is running:

```bash
docker --version
docker-compose --version
```

---

## 1. Clone and go to project root

From your workspace directory:

```bash
git clone <repository-url>
cd Sophia.AI-Academia-Blockchain
```

All following commands are run from this **project root** (where `docker-compose.yml` lives).

---

## 2. Environment files

### Backend

```bash
cp acbc_app/.env.example acbc_app/.env
```

Edit `acbc_app/.env`. At minimum set:

```env
ACADEMIA_BLOCKCHAIN_SKEY=your-secret-key-here
ENVIRONMENT=DEVELOPMENT
DEBUG=True
```

Database defaults in `docker-compose.yml` (e.g. `DB_HOST=postgres`, `DB_NAME`, `POSTGRES_USER`, `POSTGRES_PASSWORD`) work for local Docker; override in `.env` only if you need to.

Optional — Google OAuth:

```env
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_SECRET_KEY=your-secret-key
```

### Frontend

```bash
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000/api
VITE_GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
```

---

## 3. Build and start the app (Docker)

From the **project root**:

```bash
docker-compose up --build
```

This will:

- Build images for `backend`, `frontend`, and `postgres`
- Start PostgreSQL
- Start the Django backend (port **8000**)
- Start the frontend (port **8080** or **5173** depending on compose)

To run in the background:

```bash
docker-compose up --build -d
```

---

## 4. How to run commands (backend)

Because the app runs in Docker, every Django or backend command is run **inside the backend container**:

```bash
docker-compose exec backend <command>
```

Examples:

| What you want to do        | Command |
|----------------------------|--------|
| Run migrations             | `docker-compose exec backend python manage.py migrate` |
| Create migrations          | `docker-compose exec backend python manage.py makemigrations` |
| Create superuser           | `docker-compose exec backend python manage.py createsuperuser` |
| Create admin (custom cmd)   | `docker-compose exec backend python manage.py create_admin` |
| Django shell                | `docker-compose exec backend python manage.py shell` |
| Run **all** tests (recommended) | `docker-compose exec backend python manage.py test tests profiles -v 2` |
| Run events tests only       | `docker-compose exec backend python tests/run_events_tests.py` |
| Run profiles tests only     | `docker-compose exec backend python manage.py test profiles -v 2` |
| Run a specific test module  | `docker-compose exec backend python manage.py test tests.test_events_models -v 2` |
| Setup Google OAuth         | `docker-compose exec backend python manage.py setup_google_oauth` |
| Load data (e.g. fixture)   | `docker-compose exec backend python manage.py loaddata <file>` |
| Populate DB (custom commands) | `docker-compose exec backend python manage.py populate_cryptocurrencies` (then `populate_users`, `populate_content`, etc.) |

Always run these from the **project root** (where `docker-compose.yml` is), not from inside `acbc_app/`.

---

## 4.1 Running tests

Tests run **inside the backend container** using Django's test runner. The backend and postgres containers must be up (`docker-compose up -d` or `docker-compose up --build`).

**From the project root:**

```bash
# Full test suite (events + profiles, ~150 tests, a few minutes)
docker-compose exec backend python manage.py test tests profiles -v 2
```

- **Events-only:** `docker-compose exec backend python tests/run_events_tests.py`
- **Profiles-only:** `docker-compose exec backend python manage.py test profiles -v 2`
- **Single module:** `docker-compose exec backend python manage.py test tests.test_events_models -v 2`

If you run Django directly on the host (no Docker), the test DB uses in-memory SQLite when it detects `test` in `sys.argv` or `USE_SQLITE_FOR_TESTS=1`. For consistency and to match production (PostgreSQL), **running tests in Docker is recommended.**

---

## 5. Database (PostgreSQL in Docker)

The database runs in the `postgres` container. Default DB name and user come from `docker-compose.yml` / `.env` (e.g. `acbc_db`, `postgres`).

Create the database if it is not created automatically:

```bash
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE acbc_db;"
```

Apply migrations:

```bash
docker-compose exec backend python manage.py migrate
```

Open a PostgreSQL shell:

```bash
docker-compose exec postgres psql -U postgres -d acbc_db
```

---

## 6. Optional: populate with test data

Run in order (from project root):

```bash
docker-compose exec backend python manage.py populate_cryptocurrencies
docker-compose exec backend python manage.py populate_users
docker-compose exec backend python manage.py populate_content
docker-compose exec backend python manage.py populate_knowledge_paths
docker-compose exec backend python manage.py populate_interactions
```

Use `--clear` to clear before populating, or `--skip-existing` to skip existing data.

---

## 7. URLs (local)

Once the stack is up:

| Service        | URL |
|----------------|-----|
| Frontend       | http://localhost:8080 or http://localhost:5173 (see `docker-compose.yml`) |
| Backend API    | http://localhost:8000 |
| Django Admin   | http://localhost:8000/admin |
| Swagger        | http://localhost:8000/swagger/ |
| ReDoc          | http://localhost:8000/redoc/ |

---

## 8. Daily workflow

- **Start the app:** from project root, `docker-compose up --build` (or `-d` for background).
- **Backend code:** edit files in `acbc_app/`; Django in the container will reload.
- **Frontend code:** edit files in `frontend/src/`; the frontend container may hot-reload depending on setup.
- **Any Django command:**  
  `docker-compose exec backend python manage.py <command>`
- **Logs:**  
  `docker-compose logs -f backend`  
  `docker-compose logs -f frontend`  
  `docker-compose logs -f postgres`
- **Stop:**  
  `docker-compose down`

---

## 9. Useful Docker commands (from project root)

```bash
# See running containers
docker-compose ps

# Restart one service
docker-compose restart backend

# Rebuild and start
docker-compose up --build backend

# Shell inside backend container
docker-compose exec backend bash

# Shell inside postgres
docker-compose exec postgres psql -U postgres -d acbc_db

# Stop and remove volumes (clean slate)
docker-compose down -v
```

---

## 10. Troubleshooting

**KeyError: 'ACADEMIA_BLOCKCHAIN_SKEY'**  
Set `ACADEMIA_BLOCKCHAIN_SKEY` in `acbc_app/.env` and restart: `docker-compose up --build -d`.

**Database connection refused / getaddrinfo failed**  
Backend must use the Docker service name as DB host (e.g. `DB_HOST=postgres`). Ensure you are running the app with `docker-compose up`, not running Django directly on the host.

**Port 8000 or 8080 already in use**  
Stop other processes using that port, or change the port mapping in `docker-compose.yml`.

**Missing logs directory**  
`docker-compose exec backend mkdir -p /app/logs`

**Clean rebuild**  
```bash
docker-compose down -v
docker-compose up --build
```

---

## More documentation

- **Local development (detailed):** [docs/deployment/local-development.md](../../docs/deployment/local-development.md) (from repository root).
- **Production deployment:** [DEPLOYMENT_QUICK_START.md](../../DEPLOYMENT_QUICK_START.md) (from repository root).
