"""Signed guest / invite tokens for Book Club onboarding."""
from django.conf import settings
from django.core import signing

GUEST_SALT = 'book-club-guest-v1'
GUEST_MAX_AGE = 60 * 60 * 24 * 30  # 30 days
PURPOSE_GUEST = 'book_club_guest'


def dump_guest_token(*, email: str, slug: str) -> str:
    return signing.dumps(
        {
            'email': email.lower().strip(),
            'slug': slug,
            'purpose': PURPOSE_GUEST,
        },
        salt=GUEST_SALT,
    )


def load_guest_token(token: str, *, expected_slug: str | None = None) -> dict:
    """
    Returns payload dict with email, slug, purpose.
    Raises signing.BadSignature / signing.SignatureExpired on failure.
    """
    data = signing.loads(token, salt=GUEST_SALT, max_age=GUEST_MAX_AGE)
    if not isinstance(data, dict) or data.get('purpose') != PURPOSE_GUEST:
        raise signing.BadSignature('Invalid guest token purpose.')
    if not data.get('email') or not data.get('slug'):
        raise signing.BadSignature('Incomplete guest token.')
    if expected_slug is not None and data['slug'] != expected_slug:
        raise signing.BadSignature('Guest token club mismatch.')
    return data


def frontend_base_url() -> str:
    return getattr(settings, 'FRONTEND_PUBLIC_URL', None) or 'http://localhost:5173'


def build_complete_account_url(*, token: str, slug: str) -> str:
    from urllib.parse import quote

    base = frontend_base_url().rstrip('/')
    next_path = quote(f'/club-de-lectura/{slug}', safe='')
    return f'{base}/profiles/completar-cuenta?token={quote(token, safe="")}&next={next_path}'
