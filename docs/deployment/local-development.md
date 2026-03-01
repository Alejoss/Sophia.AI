# Local Development Setup

This guide will help you set up the Sophia.AI Academia Blockchain project on your local machine for development.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Git** - [Download here](https://git-scm.com/downloads)
- **Docker** - [Download here](https://www.docker.com/products/docker-desktop/)
- **Docker Compose** - Usually comes with Docker Desktop

## Step 1: Clone the Repository

```bash
git clone <repository-url>
cd Sophia.AI-Academia-Blockchain
```

## Step 2: Verify Docker Installation

Make sure Docker and Docker Compose are running:

```bash
docker --version
docker-compose --version
```

## Step 3: Create Environment Files

### Backend Environment File

Create a `.env` file in the `acbc_app` directory:

```bash
# Copy the example file
cp acbc_app/.env.example acbc_app/.env
```

Edit `acbc_app/.env` with your configuration. At minimum, you need:

```env
ACADEMIA_BLOCKCHAIN_SKEY=your-secret-key-here
ENVIRONMENT=DEVELOPMENT
DEBUG=True
```

For Google OAuth (optional):
```env
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
GOOGLE_OAUTH_SECRET_KEY=your-google-oauth-secret-key
```

### Frontend Environment File

Create a `.env` file in the `frontend` directory:

```bash
# Copy the example file
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000/api
VITE_GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
```

## Step 4: Build and Start Containers

From the root directory of the project:

```bash
# Build and start all services (local development)
docker-compose up --build

# Or build and start services individually
docker-compose up --build backend
docker-compose up --build frontend
```

If you encounter permissions errors, try:

```bash
sudo docker-compose up --build
```

This will:
- Build the Docker images for backend and frontend
- Start PostgreSQL database
- Start the Django backend server on port 8000
- Start the React frontend on port 5173

### Media files persistence in development

- In development, the file `docker-compose.override.yml` (git-ignored) is used to:
  - Mount `./acbc_app` into `/app` (código del backend).
  - Montar `./acbc_app/media` en `/app/media`, de modo que los **archivos subidos se guarden en tu máquina local** y no solo en un volumen anónimo de Docker.
- **Comando local**: sigue siendo el mismo (`docker-compose up --build`); Docker Compose aplica automáticamente el override si el archivo existe.
- **Importante**: no copies `docker-compose.override.yml` al servidor de producción; allí solo debe usarse `docker-compose.yml` o el compose específico de producción.

## Step 5: Database Setup

### Create Database

The database should be created automatically by Docker Compose. If not, you can create it manually:

```bash
# Access PostgreSQL container
docker-compose exec postgres bash

# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE acbc_db;

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE acbc_db TO postgres;

# Exit
\q
exit
```

### Run Migrations

```bash
# Create migrations (if needed)
docker-compose exec backend python manage.py makemigrations

# Apply migrations
docker-compose exec backend python manage.py migrate
```

## Step 6: Setup Google OAuth (Optional)

Set up Google OAuth for social login functionality:

```bash
docker-compose exec backend python manage.py setup_google_oauth
```

**Note**: 
- This step is optional. If you don't have Google OAuth credentials, the command will show a warning and skip the setup.
- You can still use the application with regular username/password authentication.
- If you want to use Google OAuth, make sure you've created the `.env` file in the `acbc_app` directory with your Google OAuth credentials.

See [Google OAuth Setup](#google-oauth-setup) section below for details.

## Step 7: Create Admin User (Optional)

Create a superuser account for admin access:

```bash
docker-compose exec backend python manage.py create_admin
```

This will prompt you for:
- Username
- Email
- Password

## Step 8: Populate Database with Test Data (Optional)

If you want to populate the database with sample data, run these commands in order:

```bash
# 1. Populate cryptocurrencies (required for user profiles)
docker-compose exec backend python manage.py populate_cryptocurrencies

# 2. Populate users and profiles (foundation for everything else)
docker-compose exec backend python manage.py populate_users

# 3. Populate content, topics, libraries, publications, and events
docker-compose exec backend python manage.py populate_content

# 4. Populate knowledge paths, nodes, and quizzes
docker-compose exec backend python manage.py populate_knowledge_paths

# 5. Populate user interactions (comments, votes, bookmarks)
docker-compose exec backend python manage.py populate_interactions
```

**Note**: 
- Run these commands in order as they have dependencies on each other.
- You can add `--clear` flag to any command to clear existing data before populating.
- Use `--skip-existing` to skip objects that already exist.

## Step 9: Access the Application

Once everything is set up, you can access:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Django Admin**: http://localhost:8000/admin
- **API Documentation (Swagger)**: http://localhost:8000/swagger/
- **API Documentation (ReDoc)**: http://localhost:8000/redoc/

## Development Workflow

### Backend Development

- **Auto-reload**: Django will auto-reload when you modify Python files
- **Make changes**: Edit files in `acbc_app/` directory
- **Run migrations**: After model changes, run `docker-compose exec backend python manage.py makemigrations && docker-compose exec backend python manage.py migrate`
- **View logs**: `docker-compose logs -f backend`

### Frontend Development

- **Hot reload**: Vite will hot-reload when you modify React files
- **Make changes**: Edit files in `frontend/src/` directory
- **View logs**: `docker-compose logs -f frontend`

### Database Changes

- **Model changes**: Run migrations after modifying models
- **Access database**: `docker-compose exec postgres psql -U postgres -d acbc_db`

## Troubleshooting

### Common Issues

1. **Clean up after error**
   ```bash
   # Clean up volumes and rebuild
   docker-compose down -v
   docker volume prune -f
   docker-compose up --build
   ```

2. **Database Connection Error**
   - Verify PostgreSQL container is running: `docker-compose ps`
   - Check logs: `docker-compose logs postgres`
   - If you have a custom `.env` file, make sure database credentials match

3. **Missing Logs Directory**
   ```bash
   docker-compose exec backend mkdir -p /app/logs
   ```

4. **Port Already in Use**
   - Stop other services using ports 8000 or 5173
   - Or modify the ports in `docker-compose.yml`

5. **Docker Compose Version Warning**
   - The warning about `version` being obsolete is harmless
   - You can ignore it or remove the `version: '3.8'` line from `docker-compose.yml`

### Useful Commands

```bash
# Check if all containers are running
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Rebuild specific service
docker-compose up --build backend

# Access container shell
docker-compose exec backend bash
docker-compose exec frontend bash
docker-compose exec postgres bash

# Run full test suite (events + profiles, ~152 tests)
docker-compose exec backend python manage.py test tests profiles -v 2

# Run only events or only profiles
docker-compose exec backend python tests/run_events_tests.py
docker-compose exec backend python manage.py test profiles -v 2

# Database troubleshooting
docker-compose exec postgres psql -U postgres
```

## Google OAuth Setup

To get your Google OAuth credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client IDs
5. Set authorized redirect URIs:
   - `http://localhost:5173`
   - `http://localhost:8000/accounts/google/login/callback/`
6. Copy the Client ID and Client Secret to your `.env` files

## Next Steps

- Read the [Architecture Overview](../architecture/overview.md)
- Check the [API Documentation](../api/README.md)
- Review [Development Guides](../development/README.md)
- See [Production Deployment](production.md) for production setup

## Related Documentation

- [Environment Variables](environment-variables.md)
- [Docker Configuration](docker.md)
- [Production Deployment](production.md)

