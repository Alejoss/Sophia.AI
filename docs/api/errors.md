# API Error Handling

This document describes error responses and how to handle them in the Sophia.AI Academia Blockchain API.

## Error Response Format

All error responses follow this structure:

```json
{
  "detail": "Error message here",
  "field_name": ["Field-specific error message"]
}
```

## HTTP Status Codes

### 200 OK
Request succeeded.

### 201 Created
Resource created successfully.

### 400 Bad Request
Invalid request data or parameters.

**Example**:
```json
{
  "title": ["This field is required."],
  "email": ["Enter a valid email address."]
}
```

### 401 Unauthorized
Authentication required or invalid credentials.

**Example**:
```json
{
  "detail": "Authentication credentials were not provided."
}
```

### 403 Forbidden
Authenticated but not authorized for this action.

**Example**:
```json
{
  "detail": "You do not have permission to perform this action."
}
```

### 404 Not Found
Resource not found.

**Example**:
```json
{
  "detail": "Not found."
}
```

### 500 Internal Server Error
Server error.

**Example**:
```json
{
  "detail": "A server error occurred."
}
```

## Common Error Scenarios

### Authentication Errors

#### Missing Token
```json
{
  "detail": "Authentication credentials were not provided."
}
```
**Solution**: Include Authorization header or ensure cookies are sent.

#### Invalid Token
```json
{
  "detail": "Given token not valid for any token type",
  "code": "token_not_valid"
}
```
**Solution**: Refresh the token or re-authenticate.

#### Expired Token
```json
{
  "detail": "Token is invalid or expired"
}
```
**Solution**: Use refresh token to get new access token.

### Validation Errors

#### Field Validation
```json
{
  "username": ["A user with that username already exists."],
  "email": ["Enter a valid email address."],
  "password1": ["This password is too short. It must contain at least 8 characters."]
}
```

#### File Validation
```json
{
  "file": ["File size too large. Maximum size is 10MB."],
  "file": ["File type not supported. Allowed types: jpg, png, pdf."]
}
```

### Permission Errors

#### Not Owner
```json
{
  "detail": "You do not have permission to modify this content."
}
```

#### Not Authenticated
```json
{
  "detail": "Authentication credentials were not provided."
}
```

## Error Handling Examples

### JavaScript/React

```javascript
async function handleApiCall() {
  try {
    const response = await fetch('http://localhost:8000/api/content/', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      const error = await response.json();
      
      if (response.status === 401) {
        // Handle authentication error
        handleAuthError();
      } else if (response.status === 400) {
        // Handle validation errors
        handleValidationErrors(error);
      } else {
        // Handle other errors
        showError(error.detail || 'An error occurred');
      }
      return;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Network error:', error);
    showError('Network error. Please check your connection.');
  }
}

function handleValidationErrors(error) {
  // Display field-specific errors
  Object.keys(error).forEach(field => {
    if (Array.isArray(error[field])) {
      error[field].forEach(message => {
        showFieldError(field, message);
      });
    }
  });
}
```

### Axios Interceptor

```javascript
import axios from 'axios';

axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Try to refresh token
          return refreshTokenAndRetry(error.config);
        case 403:
          showError('You do not have permission for this action.');
          break;
        case 404:
          showError('Resource not found.');
          break;
        case 400:
          handleValidationErrors(data);
          break;
        default:
          showError(data.detail || 'An error occurred');
      }
    } else if (error.request) {
      showError('Network error. Please check your connection.');
    }
    
    return Promise.reject(error);
  }
);
```

## Best Practices

1. **Always check response status** before processing data
2. **Handle authentication errors** by refreshing tokens
3. **Display user-friendly messages** for validation errors
4. **Log errors** for debugging
5. **Provide fallback behavior** for network errors
6. **Validate on client side** before sending requests

## Related Documentation

- [API Endpoints](endpoints.md)
- [Authentication](authentication.md)
- [API Examples](examples.md)

