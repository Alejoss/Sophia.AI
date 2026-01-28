# API Security

This document covers API security practices and measures.

## Input Validation

- **Serializer Validation**: All input validated through DRF serializers
- **Field Validation**: Type checking, length limits, format validation
- **File Validation**: File type and size restrictions

## SQL Injection Prevention

- **ORM Usage**: Django ORM prevents SQL injection
- **Parameterized Queries**: All queries use parameterization
- **No Raw SQL**: Avoid raw SQL in application code. The only `cursor.execute` usage is in `debug_db.py` (diagnostic script); it must not run in production (script exits if `ENVIRONMENT=PRODUCTION`).

## XSS Prevention

- **Content Sanitization**: User-generated content sanitized
- **CSP Headers**: Content Security Policy headers (when configured)
- **Template Escaping**: Django templates auto-escape

## CSRF Protection

- **CSRF Tokens**: Required for state-changing operations
- **SameSite Cookies**: Lax policy for CSRF protection
- **CORS Configuration**: Properly configured CORS origins

## Rate Limiting

- **Login**: Per-IP rate limit enforced (20 failed attempts); returns 429 when exceeded. See `profiles.views` custom login.
- **Registration, password reset, search, expensive endpoints**: Not yet limited. Consider:
  - Per-IP limits (e.g. `django-ratelimit` or API gateway)
  - Per-user limits for authenticated endpoints
  - Endpoint-specific limits for costly operations

## Error responses

- Do not expose `str(exception)` or stack traces in API responses. Use generic messages for 5xx.
- See [Error response standard](../api/error-response-standard.md) for status codes and JSON shape.

## Related Documentation

- [Authentication Security](authentication.md)
- [Best Practices](best-practices.md)
- [Error response standard](../api/error-response-standard.md)

