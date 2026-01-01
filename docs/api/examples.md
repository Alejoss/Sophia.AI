# API Usage Examples

This document provides practical examples of using the Sophia.AI Academia Blockchain API.

## Authentication Examples

### Register a New User

```javascript
const response = await fetch('http://localhost:8000/api/rest-auth/registration/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'johndoe',
    email: 'john@example.com',
    password1: 'securepassword123',
    password2: 'securepassword123'
  }),
  credentials: 'include'
});

const data = await response.json();
// Tokens are stored in cookies automatically
```

### Login

```javascript
const response = await fetch('http://localhost:8000/api/rest-auth/login/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'johndoe',
    password: 'securepassword123'
  }),
  credentials: 'include'
});
```

### Get Current User Profile

```javascript
const response = await fetch('http://localhost:8000/api/profiles/me/', {
  headers: {
    'Authorization': 'Bearer <access_token>'
  },
  credentials: 'include'
});

const profile = await response.json();
```

## Content Examples

### Create Content

```javascript
const formData = new FormData();
formData.append('original_title', 'Introduction to Blockchain');
formData.append('media_type', 'TEXT');
formData.append('file', fileInput.files[0]);
formData.append('topics', JSON.stringify([1, 2]));

const response = await fetch('http://localhost:8000/api/content/', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <access_token>'
  },
  body: formData,
  credentials: 'include'
});
```

### List Content with Filters

```javascript
const params = new URLSearchParams({
  page: 1,
  page_size: 10,
  media_type: 'VIDEO',
  topic: 5
});

const response = await fetch(`http://localhost:8000/api/content/?${params}`, {
  credentials: 'include'
});

const data = await response.json();
// data.results contains the content list
// data.count contains total count
// data.next and data.previous contain pagination URLs
```

## Events Examples

### Create an Event

```javascript
const response = await fetch('http://localhost:8000/api/events/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <access_token>'
  },
  body: JSON.stringify({
    title: 'Blockchain Workshop',
    description: 'Learn about blockchain technology',
    start_date: '2024-12-01T10:00:00Z',
    end_date: '2024-12-01T16:00:00Z',
    location: 'Online'
  }),
  credentials: 'include'
});
```

## Knowledge Path Examples

### Create a Knowledge Path

```javascript
const response = await fetch('http://localhost:8000/api/knowledge_paths/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <access_token>'
  },
  body: JSON.stringify({
    title: 'Blockchain Fundamentals',
    description: 'Complete guide to blockchain technology',
    nodes: [
      {
        title: 'Introduction',
        description: 'What is blockchain?',
        order: 1,
        content_id: 1
      }
    ]
  }),
  credentials: 'include'
});
```

## Comments Examples

### Add a Comment

```javascript
const response = await fetch('http://localhost:8000/api/comments/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <access_token>'
  },
  body: JSON.stringify({
    content: 123,
    text: 'Great article! Very informative.',
    parent: null  // null for top-level comment
  }),
  credentials: 'include'
});
```

### Reply to a Comment

```javascript
const response = await fetch('http://localhost:8000/api/comments/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <access_token>'
  },
  body: JSON.stringify({
    content: 123,
    text: 'I agree!',
    parent: 45  // ID of parent comment
  }),
  credentials: 'include'
});
```

## Votes Examples

### Vote on Content

```javascript
const response = await fetch('http://localhost:8000/api/votes/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <access_token>'
  },
  body: JSON.stringify({
    content_type: 'content',
    object_id: 123,
    value: 1  // 1 for upvote, -1 for downvote, 0 to remove vote
  }),
  credentials: 'include'
});
```

## Using Axios (Frontend)

### Setup Axios Instance

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  withCredentials: true,  // Include cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(config => {
  const token = getAccessToken();  // Your token getter
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const refreshToken = getRefreshToken();
      const response = await axios.post('http://localhost:8000/api/rest-auth/token/refresh/', {
        refresh: refreshToken
      });
      setAccessToken(response.data.access);
      // Retry original request
      return api.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

### Using the API Instance

```javascript
// Get content
const content = await api.get('/content/');

// Create content
const newContent = await api.post('/content/', {
  original_title: 'New Content',
  media_type: 'TEXT'
});

// Update profile
const updatedProfile = await api.patch('/profiles/me/', {
  interests: 'Blockchain, AI'
});
```

## Error Handling

```javascript
try {
  const response = await fetch('http://localhost:8000/api/content/', {
    credentials: 'include'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.message);
  }
  
  const data = await response.json();
  return data;
} catch (error) {
  console.error('API Error:', error);
  // Handle error
}
```

## Related Documentation

- [API Endpoints](endpoints.md)
- [Authentication](authentication.md)
- [Error Handling](errors.md)

