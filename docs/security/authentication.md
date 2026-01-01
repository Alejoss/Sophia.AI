# Authentication Security

This document covers authentication and authorization security practices.

## Authentication Methods

### JWT Tokens

- **Access Token**: Short-lived (15 minutes)
- **Refresh Token**: Long-lived (30 days) with rotation
- **Storage**: HTTP-only cookies (preferred) or secure storage

### Google OAuth

- Secure OAuth 2.0 flow
- Token verification on backend
- User creation/update on first login

## Security Practices

1. **Token Expiration**: Short-lived access tokens
2. **Token Rotation**: Refresh tokens rotated on use
3. **HTTP-Only Cookies**: Prevents XSS attacks
4. **Secure Flag**: Cookies marked secure in production (HTTPS)
5. **SameSite**: Lax policy for CSRF protection

## Authorization

- **Permission Checks**: Verify user permissions on all protected endpoints
- **Resource Ownership**: Verify user owns resource before modification
- **Role-Based Access**: Support for different user roles (teacher, student, etc.)

## Related Documentation

- [Authentication API](../api/authentication.md)
- [API Security](api-security.md)
- [Best Practices](best-practices.md)

