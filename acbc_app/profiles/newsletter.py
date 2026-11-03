"""Newsletter signup persistence, unsubscribe links, and the public per-IP rate limit."""

import secrets
from datetime import timedelta

from django.db import IntegrityError
from django.db.models import F
from django.urls import reverse
from django.utils import timezone

from profiles.models import NewsletterSubscribeRateLimit, NewsletterSubscription

# Public clients may only store these tags. Anything else is replaced so a
# request cannot write an arbitrary label into the admin notification.
NEWSLETTER_SOURCE_LABELS = {
    'club_de_lectura': 'Club de Lectura',
    'frontend_subscribe': 'Página /unirme',
    'subscribe_page': 'Página de suscripción',
}

NEWSLETTER_SUBSCRIBE_LIMIT = 5
NEWSLETTER_SUBSCRIBE_WINDOW = timedelta(hours=1)
NEWSLETTER_RATE_LIMIT_MESSAGE = (
    'Demasiados intentos. Inténtalo de nuevo más tarde.'
)
NEWSLETTER_SUBSCRIBED_EMAIL_SESSION_KEY = 'newsletter_subscribed_email'
NEWSLETTER_SUCCESS_MESSAGE = 'Suscripción registrada correctamente.'


def newsletter_source_label(source: str) -> str:
    return NEWSLETTER_SOURCE_LABELS.get(source, 'No especificada')


def normalize_newsletter_source(raw, default: str = 'frontend_subscribe') -> str:
    source = str(raw or '').strip()[:100]
    if source in NEWSLETTER_SOURCE_LABELS:
        return source
    return default


def newsletter_client_ip(request) -> str:
    """
    IP used for the signup limit.

    Nginx overwrites X-Real-IP with $remote_addr. The first X-Forwarded-For
    hop is whatever the client sent, so it is not used here.
    """
    real_ip = (request.META.get('HTTP_X_REAL_IP') or '').strip()
    if real_ip:
        return real_ip[:64]
    remote = (request.META.get('REMOTE_ADDR') or '').strip()
    return (remote or 'unknown')[:64]


def consume_newsletter_subscribe_attempt(request) -> bool:
    """
    Count one signup attempt for this client.

    Returns False when the IP is already at the limit for the current window.
    Simultaneous requests can pass the check together and exceed the limit
    by a few; they cannot open a new window or pick a fresh address.
    """
    ip = newsletter_client_ip(request)
    now = timezone.now()
    try:
        bucket, created = NewsletterSubscribeRateLimit.objects.get_or_create(
            ip_address=ip,
            defaults={'window_start': now, 'request_count': 1},
        )
    except IntegrityError:
        bucket = NewsletterSubscribeRateLimit.objects.get(ip_address=ip)
        created = False

    if created:
        return True

    if now - bucket.window_start >= NEWSLETTER_SUBSCRIBE_WINDOW:
        bucket.window_start = now
        bucket.request_count = 1
        bucket.save(update_fields=['window_start', 'request_count'])
        return True

    if bucket.request_count >= NEWSLETTER_SUBSCRIBE_LIMIT:
        return False

    NewsletterSubscribeRateLimit.objects.filter(pk=bucket.pk).update(
        request_count=F('request_count') + 1
    )
    return True


def generate_unsubscribe_token() -> str:
    """Unguessable secret for one subscriber's baja link."""
    return secrets.token_urlsafe(32)


def newsletter_public_base_url() -> str:
    """
    Origin used in links we put in outgoing mail.

    Matches the brand context so a production send never points at localhost
    when the public URL was left at the dev default.
    """
    from profiles.email_service import EmailService

    return EmailService.get_brand_context()['backend_url'].rstrip('/')


def newsletter_unsubscribe_path(token: str) -> str:
    return reverse('profiles:newsletter_unsubscribe', kwargs={'token': token})


def newsletter_unsubscribe_url(subscription) -> str:
    """Absolute baja link for this subscriber. Each address has its own token."""
    return f"{newsletter_public_base_url()}{newsletter_unsubscribe_path(subscription.unsubscribe_token)}"


def newsletter_list_unsubscribe_headers(unsubscribe_url: str) -> dict:
    """
    RFC 8058 one-click headers.

    Mail clients POST to the same URL with ``List-Unsubscribe=One-Click``.
    A newline in the URL would break the header, so those values are dropped.
    """
    if not unsubscribe_url or any(char in unsubscribe_url for char in '\r\n'):
        return {}
    return {
        'List-Unsubscribe': f'<{unsubscribe_url}>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }


def mask_newsletter_email(email: str) -> str:
    """Show just enough of the address to confirm which inbox is leaving."""
    local, _, domain = (email or '').partition('@')
    if not local or not domain:
        return ''
    visible = local[0]
    return f'{visible}***@{domain}'


def save_newsletter_subscription(email: str, source: str) -> bool:
    """
    Store the address.

    Returns True when this call created the row or turned a previous baja
    back on. A second signup of someone who is already active returns False.
    """
    try:
        subscription, created = NewsletterSubscription.objects.get_or_create(
            email=email,
            defaults={'source': source},
        )
    except IntegrityError:
        return False
    if created:
        return True
    if subscription.is_active:
        return False
    subscription.is_active = True
    subscription.unsubscribed_at = None
    subscription.save(update_fields=['is_active', 'unsubscribed_at'])
    return True


def unsubscribe_newsletter(token: str):
    """
    Turn off the subscription that owns this token.

    Returns ``(subscription or None, outcome)`` where outcome is
    ``unsubscribed``, ``already``, or ``invalid``.
    A second call keeps the original ``unsubscribed_at``.
    """
    subscription = NewsletterSubscription.objects.filter(unsubscribe_token=token).first()
    if subscription is None:
        return None, 'invalid'
    if not subscription.is_active:
        return subscription, 'already'
    subscription.is_active = False
    subscription.unsubscribed_at = timezone.now()
    subscription.save(update_fields=['is_active', 'unsubscribed_at'])
    return subscription, 'unsubscribed'


def active_newsletter_subscriptions():
    return NewsletterSubscription.objects.filter(is_active=True).order_by('email')
