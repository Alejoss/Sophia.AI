# API Endpoints Reference

Complete reference for all API endpoints in the Sophia.AI Academia Blockchain API.

**Base URL**: `http://localhost:8000/api` (development)

## Authentication Endpoints

See [Authentication Documentation](authentication.md) for detailed authentication endpoints.

## Profiles

### Get Current User Profile
- **GET** `/api/profiles/me/`
- **Auth**: Required
- **Response**: User profile object

### Update Profile
- **PATCH** `/api/profiles/me/`
- **Auth**: Required
- **Body**: Profile fields to update

### Get User Profile
- **GET** `/api/profiles/{id}/`
- **Auth**: Optional
- **Response**: Public profile information

## Content

### List Content
- **GET** `/api/content/`
- **Auth**: Optional
- **Query Params**: `page`, `page_size`, `media_type`, `topic`
- **Response**: Paginated list of content

### Create Content
- **POST** `/api/content/`
- **Auth**: Required
- **Body**: Content data (title, media_type, file, etc.)

### Get Content Detail
- **GET** `/api/content/{id}/`
- **Auth**: Optional
- **Response**: Content detail with related data

### Update Content
- **PATCH** `/api/content/{id}/`
- **Auth**: Required (must be owner)
- **Body**: Content fields to update

### Delete Content
- **DELETE** `/api/content/{id}/`
- **Auth**: Required (must be owner)

## Events

### List Events
- **GET** `/api/events/`
- **Auth**: Optional
- **Query Params**: `page`, `page_size`, `upcoming`
- **Response**: Paginated list of events

### Create Event
- **POST** `/api/events/`
- **Auth**: Required
- **Body**: Event data (title, description, start_date, etc.)

### Get Event Detail
- **GET** `/api/events/{id}/`
- **Auth**: Optional
- **Response**: Event detail

### Update Event
- **PATCH** `/api/events/{id}/`
- **Auth**: Required (must be creator)

### Delete Event
- **DELETE** `/api/events/{id}/`
- **Auth**: Required (must be creator)

## Knowledge Paths

### List Knowledge Paths
- **GET** `/api/knowledge_paths/`
- **Auth**: Optional
- **Response**: List of knowledge paths

### Create Knowledge Path
- **POST** `/api/knowledge_paths/`
- **Auth**: Required
- **Body**: Knowledge path data

### Get Knowledge Path Detail
- **GET** `/api/knowledge_paths/{id}/`
- **Auth**: Optional
- **Response**: Knowledge path with nodes

### Update Knowledge Path
- **PATCH** `/api/knowledge_paths/{id}/`
- **Auth**: Required (must be creator)

## Quizzes

### List Quizzes
- **GET** `/api/quizzes/`
- **Auth**: Optional
- **Response**: List of quizzes

### Create Quiz
- **POST** `/api/quizzes/`
- **Auth**: Required
- **Body**: Quiz data with questions

### Get Quiz Detail
- **GET** `/api/quizzes/{id}/`
- **Auth**: Optional
- **Response**: Quiz with questions

### Submit Quiz
- **POST** `/api/quizzes/{id}/submit/`
- **Auth**: Required
- **Body**: Answers
- **Response**: Score and results

## Comments

### List Comments
- **GET** `/api/comments/`
- **Auth**: Optional
- **Query Params**: `content_id`, `parent`
- **Response**: List of comments

### Create Comment
- **POST** `/api/comments/`
- **Auth**: Required
- **Body**: Comment text and content_id

### Update Comment
- **PATCH** `/api/comments/{id}/`
- **Auth**: Required (must be author)

### Delete Comment
- **DELETE** `/api/comments/{id}/`
- **Auth**: Required (must be author)

## Votes

### Vote on Content
- **POST** `/api/votes/`
- **Auth**: Required
- **Body**: `content_id`, `value` (-1, 0, or 1), `topic_id` (optional)
- **Response**: Updated vote count

### Get User Vote
- **GET** `/api/votes/?content_id={id}&topic_id={id}`
- **Auth**: Required
- **Response**: User's vote status

## Bookmarks

### List Bookmarks
- **GET** `/api/bookmarks/`
- **Auth**: Required
- **Response**: User's bookmarks

### Create Bookmark
- **POST** `/api/bookmarks/`
- **Auth**: Required
- **Body**: `content_id`

### Delete Bookmark
- **DELETE** `/api/bookmarks/{id}/`
- **Auth**: Required

## Messages

### List Conversations
- **GET** `/api/messages/`
- **Auth**: Required
- **Response**: List of message threads

### Get Conversation
- **GET** `/api/messages/{user_id}/`
- **Auth**: Required
- **Response**: Messages with specific user

### Send Message
- **POST** `/api/messages/`
- **Auth**: Required
- **Body**: `receiver_id`, `content`

## Certificates

### List Certificates
- **GET** `/api/certificates/`
- **Auth**: Required
- **Response**: User's certificates

### Request Certificate
- **POST** `/api/certificates/request/`
- **Auth**: Required
- **Body**: Certificate request data

### Get Certificate Detail
- **GET** `/api/certificates/{id}/`
- **Auth**: Required (must be owner)

## Search

### Search Content
- **GET** `/api/search/`
- **Auth**: Optional
- **Query Params**: `q` (search query), `type`, `page`
- **Response**: Search results

## Notifications

### List Notifications
- **GET** `/api/notifications/`
- **Auth**: Required
- **Query Params**: `unread_only`
- **Response**: User's notifications

### Mark as Read
- **PATCH** `/api/notifications/{id}/read/`
- **Auth**: Required

## Interactive Documentation

For detailed request/response schemas and to test endpoints:

- **Swagger UI**: http://localhost:8000/swagger/
- **ReDoc**: http://localhost:8000/redoc/

## Related Documentation

- [Authentication](authentication.md)
- [API Examples](examples.md)
- [Error Handling](errors.md)

