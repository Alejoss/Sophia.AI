# API Security

This document covers API security practices and measures.

## Input Validation

- **Serializer Validation**: All input validated through DRF serializers
- **Field Validation**: Type checking, length limits, format validation
- **File Validation**: File type and size restrictions

## SQL Injection Prevention

- **ORM Usage**: Django ORM prevents SQL injection
- **Parameterized Queries**: All queries use parameterization
- **No Raw SQL**: Avoid raw SQL queries where possible

## XSS Prevention

- **Content Sanitization**: User-generated content sanitized
- **CSP Headers**: Content Security Policy headers (when configured)
- **Template Escaping**: Django templates auto-escape

## CSRF Protection

- **CSRF Tokens**: Required for state-changing operations
- **SameSite Cookies**: Lax policy for CSRF protection
- **CORS Configuration**: Properly configured CORS origins

## Rate Limiting

Currently not enforced. Consider implementing:
- Per-user rate limits
- Per-IP rate limits
- Endpoint-specific limits

## Related Documentation

- [Authentication Security](authentication.md)
- [Best Practices](best-practices.md)

