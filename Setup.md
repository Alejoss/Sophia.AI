# Sophia.AI Academia Blockchain - Setup Guide

This guide will help you set up the Sophia.AI Academia Blockchain project on your local machine.

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

The Docker Compose configuration includes default environment variables for basic functionality. However, you'll need to create environment files if you want to use Google OAuth or customize settings.

### Frontend Environment File (Required for Google OAuth)

Create a `.env` file in the `frontend` directory:

```bash
# Create the file
touch frontend/.env
```

Add the following content to `frontend/.env`:

```env
# API Configuration
VITE_API_URL=http://localhost:8000

# Google OAuth (optional - only if you want social login)
VITE_GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
```

### Backend Environment File (Required for Google OAuth)

Create a `.env` file in the `acbc_app` directory for Google OAuth credentials:

```bash
# Create the file
touch acbc_app/.env
```

Add the following content to `acbc_app/.env`:

```env
# Google OAuth (required for social login)
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
GOOGLE_OAUTH_SECRET_KEY=your-google-oauth-secret-key

# Optional: Sentry for error tracking
# SENTRY_DSN=your-sentry-dsn
# ENVIRONMENT=development
```

**Note**: 
- The database configuration is handled directly in the Docker Compose file, so you don't need to specify database credentials in the `.env` file.
- The `.env` file should be added to `.gitignore` to keep your credentials secure.

## Step 4: Build and Start Containers

From the root directory of the project, run:

```bash
# Build and start all services
docker-compose up --build

# Or build and start services individually
docker-compose up --build backend
docker-compose up --build frontend
```
If there is a permissions error, try building with "sudo"

This will:
- Build the Docker images for backend and frontend
- Start PostgreSQL database
- Start the Django backend server on port 8000
- Start the React frontend on port 5173

## Step 5: Run Database Migrations

Once the containers are running, execute the following commands:

```bash
# Run Django migrations
docker-compose exec backend python manage.py migrate
```

## Step 6: Setup Google OAuth (Optional)

Set up Google OAuth for social login functionality:

```bash
docker-compose exec backend python manage.py setup_google_oauth
```

**Note**: 
- This step is optional. If you don't have Google OAuth credentials, the command will show a warning and skip the setup. You can still use the application with regular username/password authentication.
- If you want to use Google OAuth, make sure you've created the `.env` file in the `acbc_app` directory with your Google OAuth credentials.

## Step 7: Create Admin User (Optional)

Create a superuser account for admin access:

```bash
docker-compose exec backend python manage.py create_admin
```

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

**Note**: You can add `--clear` flag to any command to clear existing data before populating, or `--skip-existing` to skip objects that already exist.

## Step 9: Access the Application

Once everything is set up, you can access:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Django Admin**: http://localhost:8000/admin

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
   - Test database connection manually (see troubleshooting commands below)

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

# Run tests
docker-compose exec backend python manage.py test -v 2

# Database troubleshooting commands
# Connect to PostgreSQL container
docker-compose exec postgres bash

# Inside PostgreSQL container, connect to psql
psql -U postgres

# List databases
\l

# Create database if it doesn't exist
CREATE DATABASE acbc_db;

# Create user if needed
CREATE USER postgres WITH PASSWORD 'postgres';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE acbc_db TO postgres;

# Test connection from backend container
docker-compose exec backend psql -h postgres -U postgres -d acbc_db

# Check PostgreSQL logs
docker-compose logs postgres | grep -i "password\|authentication\|error"

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

## Development Workflow

- **Backend changes**: The Django app will auto-reload when you modify Python files
- **Frontend changes**: Vite will hot-reload when you modify React files
- **Database changes**: Run migrations after model changes
- **New dependencies**: Rebuild containers after adding new packages

## Production Deployment

For production deployment, make sure to:

1. Change `DEBUG=False` in the backend `.env`
2. Set a proper `SECRET_KEY`
3. Configure proper database credentials
4. Set up proper domain names in `ALLOWED_HOSTS`
5. Configure SSL certificates
6. Set up proper Google OAuth redirect URIs for your domain

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the logs: `docker-compose logs`
3. Check the [README.md](acbc_app/README.md) for additional information
4. Create an issue in the repository

---

**Happy coding! 🚀**
