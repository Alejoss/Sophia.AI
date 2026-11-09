"""Google ID-token sign-in: find or create the user and the social link.

Production Postgres is SQL_ASCII. allauth stores SocialAccount.extra_data as
jsonb, and jsonb rejects any non-ASCII byte with
"conversion between UTF8 and SQL_ASCII is not supported". The Google token
includes the person's name, so first-time sign-in failed after the user row
was already inserted. prepare_json_for_db strips those characters only on
SQL_ASCII; a UTF-8 database keeps them.
"""

from __future__ import annotations

import re

from allauth.socialaccount.models import SocialAccount
from allauth.socialaccount.providers.google.provider import GoogleProvider
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction

from utils.db_encoding import (
    is_sql_ascii_error,
    prepare_json_for_db,
    prepare_text_for_db,
    to_ascii_safe_json,
)

_USERNAME_SAFE = re.compile(r'[^\w.@+-]', re.UNICODE)


class GoogleAuthError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _email_is_verified(decoded_token: dict) -> bool:
    value = decoded_token.get('email_verified', True)
    if isinstance(value, str):
        return value.strip().lower() != 'false'
    return value is not False


def allocate_username(email: str) -> str:
    """Build a unique username from the mailbox name."""
    local = email.split('@', 1)[0]
    # Identifiers, not display names. Fold accents when the DB cannot store them.
    local = prepare_text_for_db(local)
    cleaned = _USERNAME_SAFE.sub('', local).strip('._+-@')
    if not cleaned:
        cleaned = 'user'
    max_len = User._meta.get_field('username').max_length
    base = cleaned[:max_len]
    candidate = base
    counter = 1
    while User.objects.filter(username=candidate).exists():
        suffix = str(counter)
        candidate = f'{base[: max_len - len(suffix)]}{suffix}'
        counter += 1
        if counter > 1000:
            break
    return candidate


def _create_user(email: str, given_name: str, family_name: str) -> User:
    given_name = (given_name or '')[:150]
    family_name = (family_name or '')[:150]
    last_integrity = None
    for _attempt in range(3):
        try:
            with transaction.atomic():
                return User.objects.create_user(
                    username=allocate_username(email),
                    email=email,
                    first_name=given_name,
                    last_name=family_name,
                )
        except IntegrityError as exc:
            # Username taken between the lookup and the insert.
            last_integrity = exc
            continue
        except Exception as exc:
            if not is_sql_ascii_error(exc):
                raise
            with transaction.atomic():
                return User.objects.create_user(
                    username=allocate_username(email),
                    email=email,
                    first_name=prepare_text_for_db(given_name)[:150],
                    last_name=prepare_text_for_db(family_name)[:150],
                )
    raise GoogleAuthError(
        'No se pudo crear la cuenta. Inténtalo de nuevo.',
        status_code=409,
    ) from last_integrity


def _store_social_account(user, sub: str, decoded_token: dict) -> SocialAccount:
    """Insert the Google link. jsonb on SQL_ASCII cannot store the raw token."""
    payloads = (
        prepare_json_for_db(decoded_token),
        to_ascii_safe_json(decoded_token),
    )
    last_exc = None
    for index, payload in enumerate(payloads):
        try:
            with transaction.atomic():
                return SocialAccount.objects.create(
                    user=user,
                    provider=GoogleProvider.id,
                    uid=sub,
                    extra_data=payload,
                )
        except IntegrityError:
            return SocialAccount.objects.select_related('user').get(
                provider=GoogleProvider.id,
                uid=sub,
            )
        except Exception as exc:
            last_exc = exc
            if not is_sql_ascii_error(exc) or index == len(payloads) - 1:
                raise
    raise last_exc


def provision_google_user(decoded_token: dict) -> User:
    """Return the user for this Google account, creating the link if needed."""
    sub = str(decoded_token.get('sub') or '').strip()
    if not sub:
        raise GoogleAuthError('La cuenta de Google no incluye un identificador.')

    existing = (
        SocialAccount.objects.select_related('user')
        .filter(provider=GoogleProvider.id, uid=sub)
        .first()
    )
    if existing is not None:
        return existing.user

    email = str(decoded_token.get('email') or '').strip()
    if not email or '@' not in email:
        raise GoogleAuthError('Correo electrónico no proporcionado por Google')
    if len(email) > User._meta.get_field('email').max_length:
        raise GoogleAuthError('El correo de Google es demasiado largo.')
    if not _email_is_verified(decoded_token):
        raise GoogleAuthError(
            'Google no ha verificado este correo. Usa otro método de acceso.'
        )

    with transaction.atomic():
        user = User.objects.filter(email__iexact=email).order_by('id').first()
        if user is None:
            user = _create_user(
                email,
                decoded_token.get('given_name') or '',
                decoded_token.get('family_name') or '',
            )
        linked = _store_social_account(user, sub, decoded_token)
        if linked.user_id != user.id:
            # Another request won the Google id. Drop the user row we just opened.
            transaction.set_rollback(True)
            return linked.user
    return user
