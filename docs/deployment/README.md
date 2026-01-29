# Deployment Documentation

This section contains guides for deploying the Sophia.AI Academia Blockchain platform in various environments.

## Deployment Guides

- **[Local Development](local-development.md)** - Setting up a local development environment
- **[Production](production.md)** - Production deployment guide
- **[Docker](docker.md)** - Docker configuration and usage
- **[Docker Checklist](docker-checklist.md)** - Backend image, entrypoint, env, volumes
- **[Nginx Routes](nginx-routes.md)** - Which config to use, route diagram, `/health/` vs `/health`, SSL
- **[CI/CD Flow](cicd-flow.md)** - GitHub Actions, deploy steps, scripts
- **[Deployment Summary](deployment-summary.md)** - Resumen y comandos
- **[Deployment Checklist](deployment-checklist.md)** - Checklist producción y mantenimiento
- **[Environment Variables](environment-variables.md)** - Environment configuration reference

## Quick Start

### Local Development

```bash
# Clone repository
git clone <repository-url>
cd Sophia.AI-Academia-Blockchain

# Start services
docker-compose up --build

# Run migrations
docker-compose exec backend python manage.py migrate

# Access application
# Frontend: http://localhost:5173
# Backend: http://localhost:8000
```

See [Local Development Guide](local-development.md) for detailed instructions.

### Production

1. Set up environment variables (see [Environment Variables](environment-variables.md))
2. Configure database
3. Set up reverse proxy (nginx)
4. Configure SSL certificates
5. Deploy using Docker or traditional deployment

See [Production Guide](production.md) for detailed instructions.

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Static files collected
- [ ] Media files configured (local storage)
- [ ] SSL certificates installed
- [ ] CORS configured for production domains
- [ ] Google OAuth redirect URIs updated
- [ ] Monitoring and logging configured
- [ ] Backup strategy in place

## Related Documentation

- [Architecture Overview](../architecture/overview.md)
- [API Documentation](../api/README.md)
- [Security Guide](../security/README.md)

