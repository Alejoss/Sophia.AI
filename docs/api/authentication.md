# Authentication API

This document describes the authentication system and endpoints for the Sophia.AI Academia Blockchain API.

## Authentication Methods

The API supports two authentication methods:

1. **JWT (JSON Web Tokens)** - Primary authentication method
2. **Google OAuth** - Social authentication via Google

## JWT Authentication

### Token Structure

- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (30 days), used to obtain new access tokens

### Token Storage

Tokens are stored in HTTP-only cookies:
- `acbc_jwt` - Access token
- `acbc_refresh_token` - Refresh token

### Registration

**Endpoint**: `POST /api/rest-auth/registration/`

**Request Body**:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password1": "securepassword123",
  "password2": "securepassword123"
}
```

**Response**:
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "pk": 1,
    "username": "johndoe",
    "email": "john@example.com"
  }
}
```

### Login

**Endpoint**: `POST /api/rest-auth/login/`

**Request Body**:
```json
{
  "username": "johndoe",
  "password": "securepassword123"
}
```

**Response**: Same as registration

### Token Refresh

**Endpoint**: `POST /api/rest-auth/token/refresh/`

**Request Body**:
```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Response**:
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Logout

**Endpoint**: `POST /api/rest-auth/logout/`

**Response**: `{"detail": "Successfully logged out."}`

## Google OAuth Authentication

### Google Login

**Endpoint**: `POST /api/rest-auth/google/login/`

**Request Body**:
```json
{
  "access_token": "google_access_token"
}
```

**Response**: Same as JWT registration/login

### OAuth Flow

1. Frontend redirects user to Google OAuth
2. User authorizes application
3. Google returns access token
4. Frontend sends token to `/api/rest-auth/google/login/`
5. Backend verifies token and creates/updates user
6. Backend returns JWT tokens

## Using Authentication in Requests

### With Cookies (Recommended)

If tokens are stored in cookies, they are automatically sent with requests:

```javascript
// Tokens are automatically included in cookies
fetch('http://localhost:8000/api/profiles/me/', {
  credentials: 'include'
});
```

### With Authorization Header

Alternatively, include the access token in the Authorization header:

```javascript
fetch('http://localhost:8000/api/profiles/me/', {
  headers: {
    'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGc...'
  }
});
```

## Token Refresh Strategy

### Automatic Refresh

The frontend should implement automatic token refresh:

```javascript
// Intercept 401 responses
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Try to refresh token
      const refreshToken = getRefreshToken();
      const response = await axios.post('/api/rest-auth/token/refresh/', {
        refresh: refreshToken
      });
      // Update access token and retry request
      setAccessToken(response.data.access);
      return axios.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

## Protected Endpoints

Most endpoints require authentication. Unauthenticated requests will receive:

**Status Code**: `401 Unauthorized`

**Response**:
```json
{
  "detail": "Authentication credentials were not provided."
}
```

## User Profile Endpoint

**Endpoint**: `GET /api/profiles/me/`

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com",
  "profile": {
    "interests": "Blockchain, AI",
    "profile_description": "Developer and educator",
    "is_teacher": true
  }
}
```

## Security Considerations

1. **HTTPS in Production**: Always use HTTPS in production
2. **Token Expiration**: Access tokens expire after 15 minutes
3. **Refresh Token Rotation**: Refresh tokens are rotated on use
4. **HTTP-Only Cookies**: Prevents XSS attacks
5. **CSRF Protection**: CSRF tokens required for state-changing operations

## Related Documentation

- [API Endpoints](endpoints.md)
- [API Examples](examples.md)
- [Error Handling](errors.md)
- [Security Guide](../security/authentication.md)

