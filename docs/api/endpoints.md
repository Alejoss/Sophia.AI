# API Endpoints Reference

Complete reference for all API endpoints in the Sophia.AI Academia Blockchain API.

**Base URL**: `http://localhost:8000/api` (development)

## Authentication Endpoints

See [Authentication Documentation](authentication.md) for detailed authentication endpoints.

## Profiles

### Get Current User Profile
- **GET** `/api/profiles/user_profile/`
- **Auth**: Required
- **Response**: User profile object

### Update Profile
- **PUT/PATCH** `/api/profiles/user_profile/`
- **Auth**: Required
- **Body**: Profile fields to update

### Get User Profile
- **GET** `/api/profiles/{id}/`
- **Auth**: Required
- **Response**: Public profile information

## Authentication (Primary SPA Flow)

### Register
- **POST** `/api/profiles/register/`
- **Auth**: Public
- **Body**: `username`, `email`, `password`
- **Response**: User payload + `access_token` and refresh cookie

### Login
- **POST** `/api/profiles/login/`
- **Auth**: Public
- **Body**: `username` (username or email), `password`
- **Response**: User payload + `access_token` and refresh cookie

### Refresh Token
- **POST** `/api/profiles/refresh_token/`
- **Auth**: Public (cookie-based)
- **Body**: None
- **Response**: New `access_token` (refresh cookie rotated when enabled)

### Check Auth
- **GET** `/api/profiles/check_auth/`
- **Auth**: Public
- **Response**: `is_authenticated`, optional `user`, and `reason`

### Logout
- **POST** `/api/profiles/logout/`
- **Auth**: Public
- **Response**: Confirmation + refresh cookie deletion

### Google OAuth Login
- **POST** `/api/rest-auth/google/login/`
- **Auth**: Public
- **Body**: `access_token` (Google ID token credential from frontend)
- **Response**: User payload + `access_token` and refresh cookie

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

## Content — Transcript ingest (external workers)

Machine-to-machine API for an external transcript worker (local Whisper, YouTube captions, S3 `file_key`). Not JWT-authenticated.

Full contract: [transcript-ingest.md](transcript-ingest.md).

### List transcript queue / topic manifest
- **GET** `/api/content/transcript-ingest/`
- **Auth**: `X-Transcript-Ingest-Key` or `Authorization: Bearer` (`TRANSCRIPT_INGEST_API_KEY`)
- **Query**: `topic_id`, `include_completed`, `media_type`, `content_id`, `limit`, `offset`
- **Response**: `{ count, limit, offset, include_completed, topic_id, items[] }` with YouTube/S3 hints per item

### Get transcript job detail
- **GET** `/api/content/transcript-ingest/{content_id}/`
- **Auth**: Ingest API key
- **Response**: `{ content, has_transcript, transcript }` (summary metadata only)

### Upsert transcript
- **PUT** `/api/content/transcript-ingest/{content_id}/`
- **Auth**: Ingest API key
- **Body**: at least one of `parsed_plain`, `processed_plain`, `obsidian_markdown`; optional `source_subtitles`, `format`, `language`
- **Response**: `{ content_id, created, transcript }` (201 create / 200 update)

## Topics — Timeline

Editorial timeline attached to a topic. One timeline per topic; entries are ordered and can link topic content.

### Get Topic Timeline
- **GET** `/api/content/topics/{topic_id}/timeline/`
- **Auth**: Required
- **Response**: Timeline object with `entries[]` (each entry has `title`, `description`, `start_date`, `end_date`, `order`, `contents[]`). Returns empty shell (`entries: []`) if no timeline exists yet.

### Create Timeline Entry
- **POST** `/api/content/topics/{topic_id}/timeline/`
- **Auth**: Required (topic creator or moderator)
- **Body**:
  ```json
  {
    "title": "Entry title",
    "description": "Optional narrative text",
    "start_date": "2008-10-31",
    "end_date": null,
    "contents": [
      { "content_id": 1, "order": 1 },
      { "content_id": 2, "order": 2 }
    ]
  }
  ```
- **Response**: Created entry (201)

### Update Timeline Entry
- **PATCH** `/api/content/topics/{topic_id}/timeline/{entry_id}/`
- **Auth**: Required (topic creator or moderator)
- **Body**: Partial entry fields (same shape as create)

### Delete Timeline Entry
- **DELETE** `/api/content/topics/{topic_id}/timeline/{entry_id}/`
- **Auth**: Required (topic creator or moderator)
- **Response**: 204 No Content

### Reorder Timeline Entries
- **POST** `/api/content/topics/{topic_id}/timeline/reorder/`
- **Auth**: Required (topic creator or moderator)
- **Body**: `{ "entry_ids": [3, 1, 2] }` — must include every entry ID in the desired order
- **Response**: `{ "message": "Timeline reordered successfully" }`

## Topics — Timeline entry content suggestions

Community proposals to link existing content to a **specific timeline entry** (reviewed by topic creator/moderators). Same content may appear on multiple entries.

Full spec: [topic-timeline-entry-content-suggestions.md](../architecture/topic-timeline-entry-content-suggestions.md).

### Create entry content suggestion
- **POST** `/api/content/topics/{topic_id}/timeline/{entry_id}/content-suggestions/create/`
- **Auth**: Required (not topic creator/moderator)
- **Body**: `{ "content_id": 101, "message": "optional note for moderators" }`
- **Response**: Created suggestion (201). Content must be in the topic or in the suggester's library.

### List entry content suggestions (topic)
- **GET** `/api/content/topics/{topic_id}/timeline-entry-content-suggestions/`
- **Auth**: Required
- **Query**: `status`, `entry_id`

### Accept / reject entry content suggestion
- **POST** `/api/content/topics/{topic_id}/timeline-entry-content-suggestions/{suggestion_id}/accept/`
- **POST** `/api/content/topics/{topic_id}/timeline-entry-content-suggestions/{suggestion_id}/reject/` — body `{ "rejection_reason": "..." }` (required)
- **Auth**: Topic creator or moderator

### Delete entry content suggestion
- **DELETE** `/api/content/topics/{topic_id}/timeline-entry-content-suggestions/{suggestion_id}/`
- **Auth**: Suggester only, `PENDING` only

### My entry content suggestions
- **GET** `/api/content/user/timeline-entry-content-suggestions/`
- **Auth**: Required
- **Query**: `status`, `topic_id`

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

## Book Clubs (Club de Lectura)

Full product docs: [book-clubs.md](../architecture/book-clubs.md).

### List / Create Clubs
- **GET** `/api/book_clubs/`
- **POST** `/api/book_clubs/` (staff)
- **Auth**: GET public/auth-aware; POST staff

### Club Detail / Update
- **GET/PATCH** `/api/book_clubs/{slug}/`
- **Auth**: Required; PATCH is restricted to Django staff/superusers

### Hub Payload
- **GET** `/api/book_clubs/{slug}/hub/`
- **Auth**: Member, guest token (`X-Book-Club-Guest`), or staff
- **Response**: Progress, next mission/event, open/past questions, `quick_links.topic_id`, etc.

### Mission Schedule
- **GET/PATCH** `/api/book_clubs/{slug}/mission-schedule/`
- **Auth**: Django staff/superusers
- **PATCH body**: `{ "releases": [{ "node_id": 1, "opens_at": "2026-07-20T18:00:00Z" }] }`
- Dates must follow node order; `null` leaves a mission unscheduled/locked.
- Knowledge Path and Node endpoints accept `?club={slug}` and return
  `club_opens_at` / `club_schedule_locked`. For club members the schedule is
  also enforced server-side when the parameter is absent.

### Join / Guest Access
- **POST** `/api/book_clubs/{slug}/join/`
- **POST** `/api/book_clubs/{slug}/guest-access/` — body `{ "email" }`
- **GET** `/api/book_clubs/invite-preview/?token=…` — preview público del invite (usado al completar cuenta)

### Membership Introduction (Preséntate)
- **GET/PATCH** `/api/book_clubs/{slug}/membership/introduction/`
- Writes `Profile.profile_description` / `external_url`; sets `intro_updated_at`
- Membership stores presentation state only; it has no per-club role

### Members
- **GET** `/api/book_clubs/{slug}/members/` — by default, only memberships with `intro_updated_at` set
- **Auth**: Club member or staff; only staff/superusers may use `?include_all=1` for the full roster

### Events
- **GET/POST** `/api/book_clubs/{slug}/events/`
- **DELETE** `/api/book_clubs/{slug}/events/` — body `{ "event_id": N }`
- **DELETE** `/api/book_clubs/{slug}/events/{link_id}/` — unlink by `BookClubEvent` id
- **Auth**: Members/guests/staff may list; link and unlink operations require staff/superuser

### Foro (Discussion Questions)
- **GET/POST** `/api/book_clubs/{slug}/discussion-questions/`
- **GET/PATCH/DELETE** `/api/book_clubs/{slug}/discussion-questions/{id}/`
- Answers: **GET/POST** `/api/comments/discussion-question/{id}/`
- Canonical frontend routes: `/club-de-lectura/{slug}/foro` and `/club-de-lectura/{slug}/foro/{id}`; old `/preguntas` routes redirect
- Post-to-see: members receive no other answers until publishing their own; staff/superusers always see answers
- One active top-level answer per user; authors may edit/delete their own answer through **PATCH/DELETE** `/api/comments/{comment_id}/`
- Deleting the member's top-level answer makes it inactive and locks the other answers again

### Investigación
- Frontend route: `/club-de-lectura/{slug}/investigacion`
- Uses the club's linked `Topic` and existing Topic APIs (`/api/content/topics/{id}/basic/`, `…/timeline/`, `…/content/{media_type}/`), not a separate book-club media endpoint
- Shows VIDEO/IMAGE/AUDIO/TEXT counts and the timeline in read-only mode
- Topic and timeline data require authentication; guests are prompted to sign in or create an account

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

Custom in-app notification API under profiles. See [Notifications (backend)](../backend/notifications.md) for the verb catalog and policies.

### List Notifications
- **GET** `/api/profiles/notifications/`
- **Auth**: Required
- **Query Params**: `show_all` (`true` to include read; default is unread only)
- **Response**: `{ "notifications": [...], "cleaned_up_count": N }`
- **Note**: Automatically deletes read notifications older than 30 days for the current user.

### Unread Count
- **GET** `/api/profiles/notifications/unread-count/`
- **Auth**: Required
- **Response**: `{ "unread_count": N }`

### Mark as Read
- **POST** `/api/profiles/notifications/{id}/mark-as-read/`
- **Auth**: Required

### Mark All as Read
- **POST** `/api/profiles/notifications/mark-all-as-read/`
- **Auth**: Required

## Interactive Documentation

For detailed request/response schemas and to test endpoints:

- **Swagger UI**: http://localhost:8000/swagger/
- **ReDoc**: http://localhost:8000/redoc/

## Related Documentation

- [Authentication](authentication.md)
- [API Examples](examples.md)
- [Error Handling](errors.md)

