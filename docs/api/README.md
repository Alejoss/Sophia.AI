# API Documentation

This section provides comprehensive documentation for the Sophia.AI Academia Blockchain REST API.

## API Overview

The API is built with Django REST Framework and follows RESTful principles. All endpoints return JSON responses.

**Base URL**: `http://localhost:8000/api` (development)  
**Production URL**: `https://sophia-ai-api.algobeat.com/api`

## Interactive Documentation

- **Swagger UI**: http://localhost:8000/swagger/
- **ReDoc**: http://localhost:8000/redoc/
- **OpenAPI Schema**: http://localhost:8000/swagger.json

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. See [Authentication Guide](authentication.md) for details.

## API Endpoints

### Core Endpoints

- **[Authentication](authentication.md)** - Login, registration, token management
- **[Profiles](endpoints.md#profiles)** - User profiles and settings
- **[Content](endpoints.md#content)** - Content management
- **[Events](endpoints.md#events)** - Event management
- **[Knowledge Paths](endpoints.md#knowledge-paths)** - Learning paths
- **[Quizzes](endpoints.md#quizzes)** - Quiz system
- **[Comments](endpoints.md#comments)** - Comment system
- **[Votes](endpoints.md#votes)** - Voting system
- **[Bookmarks](endpoints.md#bookmarks)** - Bookmarking
- **[Messages](endpoints.md#messages)** - User messaging
- **[Certificates](endpoints.md#certificates)** - Certificate management
- **[Search](endpoints.md#search)** - Search functionality
- **[Notifications](endpoints.md#notifications)** - Notifications

## Request/Response Format

### Request Headers

```
Content-Type: application/json
Authorization: Bearer <access_token>
```

### Response Format

**Success Response**:
```json
{
  "id": 1,
  "field": "value"
}
```

**Error Response**:
```json
{
  "error": "Error message",
  "detail": "Detailed error information"
}
```

## Pagination

List endpoints support pagination:

```
GET /api/content/?page=1&page_size=10
```

Response includes pagination metadata:
```json
{
  "count": 100,
  "next": "http://localhost:8000/api/content/?page=2",
  "previous": null,
  "results": [...]
}
```

## Rate Limiting

Currently, rate limiting is not enforced. This may change in production.

## Error Handling

See [Error Codes](errors.md) for complete error handling documentation.

## Examples

See [API Examples](examples.md) for code examples and common use cases.

## Related Documentation

- [Authentication](authentication.md) - Authentication flows and endpoints
- [Endpoints](endpoints.md) - Complete endpoint reference
- [Examples](examples.md) - Usage examples
- [Errors](errors.md) - Error codes and handling

