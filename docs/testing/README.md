# Testing Documentation

This section covers testing strategies and patterns for the Sophia.AI Academia Blockchain platform.

## Testing Overview

The project uses pytest for backend testing and includes comprehensive test coverage for models, views, serializers, and integration scenarios.

## Test Structure

- **Backend Tests**: Located in `acbc_app/tests/` and individual app `tests.py` files
- **Frontend Tests**: (To be implemented)
- **Integration Tests**: End-to-end API tests

## Quick Start

### Run All Tests

```bash
docker-compose exec backend python manage.py test
```

### Run with Pytest

```bash
docker-compose exec backend pytest
```

### Run with Coverage

```bash
docker-compose exec backend pytest --cov=. --cov-report=html
```

## Test Documentation

- [Testing Strategy](strategy.md) - Overall testing approach
- [Backend Tests](backend-tests.md) - Django test patterns and examples
- [Frontend Tests](frontend-tests.md) - React test patterns (when available)

## Related Documentation

- [Development Guides](../development/README.md)
- [API Documentation](../api/README.md)

