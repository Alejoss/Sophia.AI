# Email Features and How to Disable Them

## Features that send email

| Feature | Backend | When it runs | Controlled by |
|--------|---------|----------------|----------------|
| **Password reset** | dj-rest-auth (`POST /api/rest-auth/password/reset/`) | User requests reset; Django sends email via `EMAIL_BACKEND` | `SEND_EMAILS` (see below) |
| **Account confirmation (verify email)** | `send_confirmation_email()` + `activate_account` | Not triggered on registration (TODO in `RegisterView`). Only `activate_account` is used if user has a link. | `EmailService` → `SEND_EMAILS` |
| **Suggestions to admins** | `SuggestionCreateView` → `_send_email_to_admins()` | When a user submits a suggestion | `EmailService` → `SEND_EMAILS` |

## Are they active?

- **By default, all email sending is off.**  
  `SEND_EMAILS` defaults to `false` (from env: `SEND_EMAILS` not set or set to `false`).
- When **`SEND_EMAILS` is False**:
  - **Password reset**: Still callable; emails are not sent (Django uses `django.core.mail.backends.dummy.EmailBackend`).
  - **Account confirmation** and **suggestions to admins**: `EmailService` checks `SEND_EMAILS` and does not send.

So until you enable email, none of these features will actually send mail (e.g. while Postmark is pending approval).

## How to disable email temporarily

- **Do nothing:** default is no email.
- Or in **`acbc_app/.env`** (on the server or locally) set:
  ```env
  SEND_EMAILS=false
  ```
  or omit `SEND_EMAILS` (default is false).

No code or UI change is required; the backend will use the dummy email backend and `EmailService` will no-op.

## How to enable email (after Postmark is approved)

1. In **`acbc_app/.env`** set:
   ```env
   SEND_EMAILS=true
   POSTMARK_SERVER_TOKEN=<your-postmark-server-token>
   ```
2. Optionally set `EMAIL_FROM`, `EMAIL_FROM_NAME`, `ADMIN_EMAIL`.
3. Restart the backend so settings are reloaded (e.g. `docker compose -f docker-compose.prod.yml restart backend`).

## Summary

- **Disable all email:** leave `SEND_EMAILS` unset or set `SEND_EMAILS=false` in `acbc_app/.env`.
- **Enable email:** set `SEND_EMAILS=true` and `POSTMARK_SERVER_TOKEN` in `acbc_app/.env`, then restart the backend.
