# Authentication API

This document describes the authentication contract currently used by the app.

## Authentication Methods

1. **JWT (custom profiles endpoints)** as primary auth flow.
2. **Google OAuth** via backend token verification.

## Token Model

- **Access token** (`15m`) returned in JSON response body.
- **Refresh token** (`30d`) stored in HTTP-only cookie `acbc_refresh_token`.
- Access token is sent by frontend as `Authorization: Bearer <token>`.

## Primary Endpoints (In Use)

### Register

**Endpoint**: `POST /api/profiles/register/`

**Request Body**:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response** (201):
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com",
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Login

**Endpoint**: `POST /api/profiles/login/`

**Request Body**:
```json
{
  "username": "johndoe",
  "password": "securepassword123"
}
```

`username` accepts username or email.

**Response** (200): same shape as register (`access_token` + user data).

### Refresh Access Token

**Endpoint**: `POST /api/profiles/refresh_token/`

- No body required.
- Reads refresh token from cookie.
- Returns a new `access_token`.
- Rotates refresh cookie when rotation is enabled.

**Response** (200):
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Check Auth State

**Endpoint**: `GET /api/profiles/check_auth/`

**Response**:
```json
{
  "is_authenticated": true,
  "user": {
    "id": 1,
    "username": "johndoe"
  },
  "reason": "access_token_valid"
}
```

Possible `reason` values:
- `access_token_valid`
- `refresh_token_present_requires_refresh`
- `no_active_session`

### Logout

**Endpoint**: `POST /api/profiles/logout/`

- Deletes `acbc_refresh_token` cookie.

### Google Login

**Endpoint**: `POST /api/rest-auth/google/login/`

**Request Body**:
```json
{
  "access_token": "google_id_token_from_client"
}
```

The field name is `access_token`, but the value is the Google ID token from the frontend credential response.

## Secondary Compatibility Endpoints

`dj-rest-auth` endpoints still exist under `/api/rest-auth/`, but the SPA currently uses `/api/profiles/*` for register/login/refresh/logout/check_auth.

## Frontend Refresh Strategy

- The frontend uses a single refresh path on `401` through Axios interceptor.
- On refresh success, it stores new access token and retries request.
- On refresh failure, it emits `auth:token_refresh_failed` for global logout handling.

## Security Notes

1. Use HTTPS in production.
2. Never log raw tokens.
3. Keep refresh token in HTTP-only cookie.
4. Enforce CSRF for state-changing operations.
5. Keep public auth endpoints explicitly marked with `AllowAny`.

## Related Documentation

- [API Endpoints](endpoints.md)
- [API Examples](examples.md)
- [Security Guide](../security/authentication.md)

