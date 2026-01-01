# API Design

This document describes the API architecture and design principles for the Sophia.AI Academia Blockchain platform.

## API Architecture

The API follows RESTful principles and is built with Django REST Framework.

### Base URL

- **Development**: `http://localhost:8000/api`
- **Production**: `https://sophia-ai-api.algobeat.com/api`

## Design Principles

### RESTful Design

- Use HTTP methods appropriately (GET, POST, PATCH, DELETE)
- Resource-based URLs
- Stateless requests
- JSON request/response format

### URL Structure

```
/api/{resource}/          # List/Create
/api/{resource}/{id}/     # Retrieve/Update/Delete
/api/{resource}/{id}/{action}/  # Custom actions
```

### HTTP Methods

- **GET**: Retrieve resources (safe, idempotent)
- **POST**: Create resources
- **PATCH**: Partial update
- **PUT**: Full update (not commonly used)
- **DELETE**: Delete resources

## Authentication

- JWT tokens in HTTP-only cookies (preferred)
- Bearer tokens in Authorization header (alternative)
- Token refresh mechanism for long-lived sessions

See [Authentication API](../api/authentication.md) for details.

## Response Format

### Success Response

```json
{
  "id": 1,
  "field": "value"
}
```

### List Response (Paginated)

```json
{
  "count": 100,
  "next": "http://localhost:8000/api/content/?page=2",
  "previous": null,
  "results": [...]
}
```

### Error Response

```json
{
  "detail": "Error message",
  "field_name": ["Field error"]
}
```

## Pagination

All list endpoints support pagination:

- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 10, max: 100)

## Filtering and Searching

Query parameters for filtering:

```
GET /api/content/?media_type=VIDEO&topic=5&page=1
```

## Versioning

Currently using implicit versioning. Future versions may use URL versioning:

```
/api/v1/content/
/api/v2/content/
```

## Rate Limiting

Currently not enforced. May be added in production.

## CORS Configuration

Configured for:
- Development: `http://localhost:5173`
- Production: Specific domains

## API Documentation

- **Swagger UI**: `/swagger/`
- **ReDoc**: `/redoc/`
- **OpenAPI Schema**: `/swagger.json`

## Related Documentation

- [API Endpoints](../api/endpoints.md)
- [API Examples](../api/examples.md)
- [Authentication](../api/authentication.md)

