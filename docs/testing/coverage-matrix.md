# Backend test coverage matrix

## Summary

| App | Has tests | Priority | Notes |
|-----|-----------|----------|-------|
| events | Yes (dedicated suite) | High | `tests/test_events_*`, factories, EVENTS_TEST_COVERAGE.md |
| content | Yes | High | Many views; N+1 and permissions important |
| profiles | Yes | High | Auth, JWT, OAuth |
| comments | Yes | High | IsAuthor, notifications |
| votes | Yes | High | Vote logic, notifications |
| certificates | Yes | Medium | Cert generation, requests |
| knowledge_paths | Yes | High | Paths, nodes, IsAuthor |
| gamification | Yes | Medium | Badges, admin actions |
| bookmarks | Yes | Low | CRUD |
| quizzes | Yes | Medium | Quiz logic |
| search | Yes | Medium | AllowAny, filters |
| user_messages | Yes | Low | Messaging |
| publications | No | Medium | Single view; add basic tests |

## CI

- **Workflow**: [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml). Test job: PostgreSQL service, Python 3.12, `manage.py migrate` → `manage.py test` → `coverage` → `manage.py check --deploy`. Runs from `acbc_app/`.
- **Deploy**: `needs: test`; only runs on `main` after tests pass. Test failure fails the job.

## Recommended adjustments

1. **Fail on test failure**: CI already fails the job if `manage.py test` exits non-zero. Ensure no `|| true` or similar on the test step.
2. **Coverage gates**: Optionally add `coverage report --fail-under=X` to enforce a minimum coverage (e.g. 50%) and fail the job if below.
3. **`check --deploy`**: Run with production-like settings where possible (e.g. `DEBUG=False`, `ENVIRONMENT=CI`). CI uses `ENVIRONMENT=CI`; adjust if `check --deploy` expects `PRODUCTION`.

## Factories

- **Existing**: `tests/factories/events.py`, `tests/factories/users.py` (factory_boy).
- **Extend**: Add factories for `content`, `profiles`, `comments`, `knowledge_paths`, etc., and use them in app tests to avoid hardcoded fixtures and reduce fragility.

## Priority tests to add

1. **publications**: Basic `PublicationDetailView` tests (auth, 404, 500 generic message).
2. **profiles**: Login rate limit, JWT refresh, Google login (mocked).
3. **content**: Permissions (IsAuthor), key CRUD flows.
4. **utils.permissions**: `IsAuthor` with `author is None` and with valid author.
