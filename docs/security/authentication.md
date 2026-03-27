# Authentication Security

This document covers authentication and authorization security practices.

## Authentication Methods

### JWT Tokens

- **Access Token**: Short-lived (15 minutes)
- **Refresh Token**: Long-lived (30 days) with rotation
- **Storage**:
  - Refresh token in HTTP-only cookie (`acbc_refresh_token`)
  - Access token in frontend runtime/local storage and sent as Bearer token

### Google OAuth

- Secure OAuth 2.0 flow
- Token verification on backend
- User creation/update on first login
- Frontend sends Google credential token in `access_token` field to `/api/rest-auth/google/login/`

## Security Practices

1. **Token Expiration**: Short-lived access tokens
2. **Token Rotation**: Refresh tokens rotated on `/api/profiles/refresh_token/`
3. **HTTP-Only Cookies**: Prevents XSS attacks
4. **Secure Flag**: Cookies marked secure in production (HTTPS)
5. **SameSite**: Lax policy for CSRF protection
6. **Logging Hygiene**: Never print or log raw access/refresh tokens

## Session Consistency Contract

- `GET /api/profiles/check_auth/` reports active auth state from validated access/session context.
- Presence of refresh cookie alone is not treated as an authenticated session.
- If refresh cookie exists without a valid access token, frontend should call `/api/profiles/refresh_token/`.

## Primary Auth Endpoints

- `POST /api/profiles/register/`
- `POST /api/profiles/login/`
- `POST /api/profiles/refresh_token/`
- `POST /api/profiles/logout/`
- `GET /api/profiles/check_auth/`
- `POST /api/rest-auth/google/login/`

## Authorization

- **Permission Checks**: Verify user permissions on all protected endpoints
- **Resource Ownership**: Verify user owns resource before modification
- **Role-Based Access**: Support for different user roles (teacher, student, etc.)

## Related Documentation

- [Authentication API](../api/authentication.md)
- [API Security](api-security.md)
- [Best Practices](best-practices.md)

