# Endpoint permissions map

Map of API endpoints by permission level (public / authenticated / author / admin).  
`DEFAULT_PERMISSION_CLASSES = [IsAuthenticated]`; views override explicitly.

## Public (`AllowAny` or `permission_classes = []`)

| Area | Endpoint / view | Notes |
|------|-----------------|-------|
| Health | `GET /health/` | Django view (not DRF). |
| API docs | `GET /swagger/`, `/redoc/`, `/swagger.json|yaml` | Schema + UI. |
| Profiles | Login, registration, Google login, password reset, etc. | dj-rest-auth + custom `GoogleLoginView`. |
| Search | `GET /api/search/...` | Public search. |
| Gamification | List badges (read) | `permission_classes = []`. |

## Authenticated (`IsAuthenticated`)

- **Profiles**: User detail, update, notifications, JWT set, etc.
- **Events**: List, create, detail, registrations (except public list if any).
- **Content**: Libraries, content CRUD, topics, suggestions, uploads, etc.
- **Comments**: List, create, replies (except `CommentView` update/delete → author).
- **Quizzes**: All quiz endpoints.
- **Certificates**: All certificate endpoints.
- **Votes**: Vote endpoints.
- **Knowledge paths**: List, create, detail, nodes (except author-only modify).
- **Bookmarks**: All bookmark endpoints.
- **User messages**: All message endpoints.
- **Publications**: Publication detail.

## Author (`IsAuthor`)

Objects must have `author` (FK to User). Used for:

| App | View | Object |
|-----|------|--------|
| Content | `KnowledgePathDetailView`, `KnowledgePathNodesView`, `NodeDetailView` | `KnowledgePath` or `Node` (via `knowledge_path`). |
| Comments | `CommentView` (update, delete) | `Comment`. |

`IsAuthor` returns `False` if `obj.author` is missing or `None`.

## Admin (`IsAdminUser`)

- **Gamification**: Admin-only action (e.g. grant badge) via `@action(..., permission_classes=[IsAdminUser])`.

## OAuth / Google

- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_SECRET_KEY`: server-side only.  
- Secret must not be exposed to frontend; client ID is public.

## Recommendations

1. Keep all public endpoints explicitly `AllowAny` or `permission_classes = []`.
2. Use `IsAuthor` only for models with `author` FK; handle `author is None` (e.g. in permission class).
3. Document admin-only actions (e.g. gamification) in API docs.
