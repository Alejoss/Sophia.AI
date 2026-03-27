# Authentication Endpoint Matrix

This table maps previously documented auth endpoints to the endpoints currently used by the SPA.

| Functional area | Previously documented | Current backend endpoint | Used by frontend | Status |
|---|---|---|---|---|
| Register | `/api/rest-auth/registration/` | `/api/profiles/register/` | Yes | Updated |
| Login | `/api/rest-auth/login/` | `/api/profiles/login/` | Yes | Updated |
| Refresh token | `/api/rest-auth/token/refresh/` | `/api/profiles/refresh_token/` | Yes | Updated |
| Logout | `/api/rest-auth/logout/` | `/api/profiles/logout/` | Yes | Updated |
| Check auth | N/A | `/api/profiles/check_auth/` | Yes | Added |
| User profile (self) | `/api/profiles/me/` | `/api/profiles/user_profile/` | Yes | Updated |
| Google OAuth | `/api/rest-auth/google/login/` | `/api/rest-auth/google/login/` | Yes | Kept |

## Notes

- `dj-rest-auth` endpoints still exist for compatibility, but the app's primary flow uses `profiles` endpoints.
- Refresh token is cookie-based (`acbc_refresh_token`) and access token is returned in response body.
