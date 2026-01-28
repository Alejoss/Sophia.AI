# Models, data, and notifications

## Indexes

Key models already use `Meta.indexes` or `unique_together`:

- **Content**: `ContentSuggestion` — `topic`+`status`, `suggested_by`+`status`.
- **Votes**: `Vote`, `VoteCount` — `content_type`+`object_id`, `topic`, `value`.
- **Comments**: `Comment` — `content_type`+`object_id`, `parent`.
- **Bookmarks**: `Bookmark` — `user`+`content_type`+`object_id`, `user`+`topic`, `created_at`.
- **Gamification**: `Badge` — `code`, `is_active`; `UserBadge` — `user`+`badge`, `earned_at`.

Consider adding indexes for:

- **Event**, **KnowledgePath**: frequent filters like `owner` / `author`, `date_created`; list views often filter or order by these.
- **Notification** (django-notifications-hq): `recipient` + `unread` if you often filter unread by user.

## N+1 and relations

- Use `select_related` / `prefetch_related` in views that serialize relations (e.g. `author`, `knowledge_path`, `content_type`).
- Existing examples: `KnowledgePath.objects.select_related('author')`, `Node.objects.select_related('knowledge_path')`, `Comment` with `content_type` / `parent`.
- Audit list/detail views that return nested serializers for missing `select_related` / `prefetch_related`.

## Notifications (django-notifications-hq, `notification_utils`)

- **Deduplication**: Helpers check for existing notifications (same `recipient`, `actor`, `verb`, `action_object`, `target`) before creating. Reduces duplicates from repeated triggers.
- **Cleanup**: Profiles views delete old read notifications (e.g. older than 30 days). Run periodically or on login to avoid unbounded growth.
- **Volume**: High-traffic features (e.g. comments, votes, suggestions) can create many notifications. Monitor DB size and consider:
  - Limiting notifications per user (e.g. cap unread, archive old).
  - Batching or throttling creation in `notification_utils` for bursty events.

## Fixtures and `load_fixtures`

- **Fixtures** (`users_fixture`, `profiles_fixture`, `content_fixture`, etc.): Contain example data (e.g. `*@example.com`, shared test password hashes). Treat as dev/staging only.
- **Production**: Do **not** run `load_fixtures` or `loaddata` against production. Use migrations and minimal bootstrap (e.g. `createsuperuser`) only.
- **`load_fixtures` management command**: Calls `loaddata` for a fixed list of fixtures. Safe only in non-production environments. Consider adding an `ENVIRONMENT == "PRODUCTION"` guard to block accidental use in prod.
