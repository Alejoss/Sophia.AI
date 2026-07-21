# Email Features and How to Disable Them

Email is sent via **SMTP2GO** using Django’s built-in **SMTP** backend (`django.core.mail.backends.smtp.EmailBackend`). When `SEND_EMAILS=true`, the app’s `EmailService` and Django’s `send_mail()` (e.g. password reset) use the same SMTP settings.

Official setup guide: [SMTP2GO + Django](https://www.smtp2go.com/setupguide/django/).

## Features that send email

| Feature | Backend | When it runs | Controlled by |
|--------|---------|----------------|----------------|
| **Password reset** | dj-rest-auth (`POST /api/rest-auth/password/reset/`) | User requests reset; Django sends email via `EMAIL_BACKEND` | `SEND_EMAILS` |
| **Account confirmation (verify email)** | `send_confirmation_email()` + `activate_account` | Not triggered on registration (TODO in `RegisterView`). Only `activate_account` is used if user has a link. | `EmailService` → `SEND_EMAILS` |
| **Suggestions to admins** | `SuggestionCreateView` → `_send_email_to_admins()` | When a user submits a suggestion | `EmailService` → `SEND_EMAILS` |
| **Book club invite** | `book_clubs.emailing.send_book_club_invite_email` | Guest leaves email / invite flow | `EmailService` → `SEND_EMAILS` |
| **Topic creation request** | `notification_utils` → admins | Staff notification for topic requests | `EmailService` → `SEND_EMAILS` |

## Are they active?

- **By default, all email sending is off.**  
  `SEND_EMAILS` defaults to `false` (from env: `SEND_EMAILS` not set or set to `false`).
- When **`SEND_EMAILS` is False**:
  - **Password reset**: Still callable; emails are not sent (Django uses `django.core.mail.backends.dummy.EmailBackend`).
  - **Account confirmation**, **suggestions**, **book club invites**, etc.: `EmailService` checks `SEND_EMAILS` and does not send.

## How to disable email temporarily

- **Do nothing:** default is no email.
- Or in **`acbc_app/.env`** set:
  ```env
  SEND_EMAILS=false
  ```
  or omit `SEND_EMAILS` (default is false).

No code or UI change is required; the backend will use the dummy email backend and `EmailService` will no-op.

## How to enable email (SMTP2GO)

1. In [SMTP2GO](https://www.smtp2go.com/): verify the sending domain (DNS / Verified Sender), create an **SMTP User**, and optionally send a test email from the dashboard.
2. In **`acbc_app/.env`** set:
   ```env
   SEND_EMAILS=true
   EMAIL_HOST=mail.smtp2go.com
   EMAIL_PORT=2525
   EMAIL_HOST_USER=<your-smtp-username>
   EMAIL_HOST_PASSWORD=<your-smtp-password>
   EMAIL_USE_TLS=true
   EMAIL_FROM=noreply@academiablockchain.com
   EMAIL_FROM_NAME=Academia Blockchain
   ```
3. Optionally set `ADMIN_EMAIL` (suggestion / newsletter notifications; staff emails are also included).
4. Restart the backend so settings are reloaded (e.g. `docker compose -f docker-compose.prod.yml restart backend`).

In production, `EMAIL_HOST`, `EMAIL_HOST_USER`, and `EMAIL_HOST_PASSWORD` are required when `SEND_EMAILS=true`; the app will raise at startup if any are missing.

`EMAIL_FROM` must use a domain verified in SMTP2GO (e.g. `noreply@academiablockchain.com`).

### Branding (logo and colors)

Transactional HTML is rendered by Django templates under `acbc_app/profiles/templates/profiles/emails/`:

- `base_email.html` — shared layout (logo, brand orange `#E86A00`, footer)
- Feature templates extend the base (`suggestion_notification`, `newsletter_subscription`, `topic_creation_request`, `book_club_invite`)

The logo URL is absolute: `{FRONTEND_PUBLIC_URL}/images/logo.png` (same asset as the web header). Set `FRONTEND_PUBLIC_URL` (and `ACADEMIA_PUBLIC_URL` for Django admin links) in production so images and CTAs resolve correctly. This is **not** configured in the SMTP2GO template editor.

### Smoke test after deploy

```bash
python manage.py shell -c "
from django.core.mail import send_mail
from django.conf import settings
print('backend=', settings.EMAIL_BACKEND)
send_mail(
    'SMTP2GO test',
    'Hello from Academia Blockchain',
    settings.DEFAULT_FROM_EMAIL,
    ['your-inbox@example.com'],
    fail_silently=False,
)
print('ok')
"
```

Then check the inbox and SMTP2GO → Activity.

## Summary

- **Disable all email:** leave `SEND_EMAILS` unset or set `SEND_EMAILS=false` in `acbc_app/.env`.
- **Enable email:** set `SEND_EMAILS=true` and the SMTP2GO `EMAIL_*` variables in `acbc_app/.env`, then restart the backend.
