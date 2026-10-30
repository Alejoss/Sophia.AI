"""Newsletter signup persistence and the public per-IP rate limit."""

from datetime import timedelta

from django.db import IntegrityError
from django.db.models import F
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


def save_newsletter_subscription(email: str, source: str) -> bool:
    """Store the address. Returns True only when this call created the row."""
    try:
        _, created = NewsletterSubscription.objects.get_or_create(
            email=email,
            defaults={'source': source},
        )
    except IntegrityError:
        return False
    return created
