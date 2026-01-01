# Environment Variables Reference

This document provides a complete reference for all environment variables used in the Sophia.AI Academia Blockchain platform.

## Backend Environment Variables

Location: `acbc_app/.env`

### Required Variables

#### `ACADEMIA_BLOCKCHAIN_SKEY`
- **Description**: Django secret key for cryptographic signing
- **Required**: Yes
- **Default**: `django-insecure-development-key-123` (development only)
- **Example**: `ACADEMIA_BLOCKCHAIN_SKEY=your-secret-key-here`
- **Generate**: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`

#### `ENVIRONMENT`
- **Description**: Application environment
- **Required**: Yes
- **Options**: `DEVELOPMENT`, `PRODUCTION`
- **Default**: `DEVELOPMENT`
- **Example**: `ENVIRONMENT=PRODUCTION`

### Database Configuration

#### `DB_NAME`
- **Description**: PostgreSQL database name
- **Required**: Yes (when ENVIRONMENT=PRODUCTION)
- **Default**: `acbc_db` (from docker-compose)
- **Example**: `DB_NAME=academiablockchain_db`

#### `DB_USER`
- **Description**: PostgreSQL database user
- **Required**: Yes (when ENVIRONMENT=PRODUCTION)
- **Default**: `postgres` (from docker-compose)
- **Example**: `DB_USER=postgres`

#### `DB_PASSWORD`
- **Description**: PostgreSQL database password
- **Required**: Yes (when ENVIRONMENT=PRODUCTION)
- **Default**: `postgres` (from docker-compose)
- **Example**: `DB_PASSWORD=secure_password_123`

#### `DB_HOST`
- **Description**: PostgreSQL database host
- **Required**: Yes (when ENVIRONMENT=PRODUCTION)
- **Default**: `postgres` (from docker-compose)
- **Example**: `DB_HOST=localhost` or `DB_HOST=postgres`

#### `DB_PORT`
- **Description**: PostgreSQL database port
- **Required**: No
- **Default**: `5432`
- **Example**: `DB_PORT=5432`

#### `POSTGRES_DB`
- **Description**: PostgreSQL database name (for docker-compose)
- **Required**: No (set in docker-compose.yml)
- **Default**: `acbc_db`
- **Example**: `POSTGRES_DB=acbc_db`

#### `POSTGRES_USER`
- **Description**: PostgreSQL user (for docker-compose)
- **Required**: No (set in docker-compose.yml)
- **Default**: `postgres`
- **Example**: `POSTGRES_USER=postgres`

#### `POSTGRES_PASSWORD`
- **Description**: PostgreSQL password (for docker-compose)
- **Required**: No (set in docker-compose.yml)
- **Default**: `postgres`
- **Example**: `POSTGRES_PASSWORD=postgres`

### Django Settings

#### `DEBUG`
- **Description**: Enable Django debug mode
- **Required**: No
- **Default**: `True` (development), `False` (production)
- **Example**: `DEBUG=False`

#### `ALLOWED_HOSTS`
- **Description**: Comma-separated list of allowed hostnames
- **Required**: No
- **Default**: `localhost,127.0.0.1,0.0.0.0`
- **Example**: `ALLOWED_HOSTS=example.com,www.example.com`

### Google OAuth (Optional)

#### `GOOGLE_OAUTH_CLIENT_ID`
- **Description**: Google OAuth 2.0 Client ID
- **Required**: No (required for Google OAuth login)
- **Example**: `GOOGLE_OAUTH_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com`
- **Get from**: [Google Cloud Console](https://console.cloud.google.com/)

#### `GOOGLE_OAUTH_SECRET_KEY`
- **Description**: Google OAuth 2.0 Client Secret
- **Required**: No (required for Google OAuth login)
- **Example**: `GOOGLE_OAUTH_SECRET_KEY=GOCSPX-abcdefghijklmnop`
- **Get from**: [Google Cloud Console](https://console.cloud.google.com/)

### AWS Configuration (Production)

#### `AWS_ACCESS_KEY_ID`
- **Description**: AWS access key ID for S3 access
- **Required**: No (required for S3 media storage)
- **Example**: `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE`

#### `AWS_SECRET_ACCESS_KEY`
- **Description**: AWS secret access key for S3 access
- **Required**: No (required for S3 media storage)
- **Example**: `AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`

#### `AWS_STORAGE_BUCKET_NAME`
- **Description**: S3 bucket name for media files
- **Required**: No (if using S3)
- **Default**: `academiablockchain`
- **Example**: `AWS_STORAGE_BUCKET_NAME=my-bucket-name`

#### `AWS_S3_REGION_NAME`
- **Description**: AWS region for S3 bucket
- **Required**: No (if using S3)
- **Default**: `us-west-2`
- **Example**: `AWS_S3_REGION_NAME=us-east-1`

### Monitoring (Optional)

#### `SENTRY_DSN`
- **Description**: Sentry DSN for error tracking
- **Required**: No
- **Example**: `SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/123456`

## Frontend Environment Variables

Location: `frontend/.env`

### Required Variables

#### `VITE_API_URL`
- **Description**: Backend API base URL
- **Required**: Yes
- **Development**: `http://localhost:8000/api`
- **Production**: `https://sophia-ai-api.algobeat.com/api`
- **Example**: `VITE_API_URL=http://localhost:8000/api`

### Google OAuth (Optional)

#### `VITE_GOOGLE_OAUTH_CLIENT_ID`
- **Description**: Google OAuth 2.0 Client ID for frontend
- **Required**: No (required for Google OAuth login)
- **Example**: `VITE_GOOGLE_OAUTH_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com`
- **Note**: Should match the backend `GOOGLE_OAUTH_CLIENT_ID` or use a separate web client ID

## Environment File Examples

### Backend Development (.env)

```env
ACADEMIA_BLOCKCHAIN_SKEY=django-insecure-development-key-123
ENVIRONMENT=DEVELOPMENT
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

# Database (usually handled by docker-compose)
DB_NAME=acbc_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=postgres

# Google OAuth (optional)
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_SECRET_KEY=your-secret-key
```

### Backend Production (.env)

```env
ACADEMIA_BLOCKCHAIN_SKEY=<generate-secure-key>
ENVIRONMENT=PRODUCTION
DEBUG=False
ALLOWED_HOSTS=example.com,www.example.com

# Database
DB_NAME=academiablockchain_prod
DB_USER=db_user
DB_PASSWORD=<secure-password>
DB_HOST=db.example.com
DB_PORT=5432

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_SECRET_KEY=your-secret-key

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_STORAGE_BUCKET_NAME=academiablockchain
AWS_S3_REGION_NAME=us-west-2

# Monitoring
SENTRY_DSN=your-sentry-dsn
```

### Frontend Development (.env)

```env
VITE_API_URL=http://localhost:8000/api
VITE_GOOGLE_OAUTH_CLIENT_ID=your-client-id
```

### Frontend Production (.env)

```env
VITE_API_URL=https://sophia-ai-api.algobeat.com/api
VITE_GOOGLE_OAUTH_CLIENT_ID=your-client-id
```

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong secret keys** in production
3. **Rotate credentials** regularly
4. **Use different credentials** for development and production
5. **Restrict AWS IAM permissions** to minimum required
6. **Use environment-specific OAuth clients** when possible

## Docker Compose Environment

Some variables are set directly in `docker-compose.yml`:

```yaml
environment:
  - DB_NAME=acbc_db
  - DB_USER=postgres
  - DB_PASSWORD=postgres
  - DB_HOST=postgres
  - DEBUG=True
  - SECRET_KEY=django-insecure-development-key-123
```

These can be overridden by `.env` file values.

## Related Documentation

- [Local Development Setup](local-development.md)
- [Production Deployment](production.md)
- [Docker Configuration](docker.md)

