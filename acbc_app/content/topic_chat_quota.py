"""Daily consultation (TopicChatQuery) quotas per user.

Free users are capped; admin allowlist and future premium / token entitlements
return unlimited via ``user_daily_consultation_limit``.
"""

from __future__ import annotations

from django.utils import timezone

from content.models import TopicChatQuery, UnlimitedConsultationUser

# Own-profile tokens section where users buy ACBC platform tokens.
TOKENS_PROFILE_PATH = '/profiles/my_profile?section=tokens'


def user_has_unlimited_consultations(user) -> bool:
    """True when the user is on the admin unlimited-consultations allowlist."""
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    user_id = getattr(user, 'pk', None) or getattr(user, 'id', None)
    if not user_id:
        return False
    return UnlimitedConsultationUser.objects.filter(user_id=user_id).exists()


def user_daily_consultation_limit(user) -> int | None:
    """
    Max consultations per calendar day (server local midnight).

    Returns None for unlimited (admin allowlist, and later premium / paid tokens).
    """
    if user_has_unlimited_consultations(user):
        return None
    # Future: if the user has an active premium/token entitlement, return None.
    return TopicChatQuery.MAX_PER_USER_PER_DAY


def _today_start():
    return timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)


def count_user_consultations_today(user) -> int:
    """Count TopicChatQuery rows for this user since local midnight (all topics)."""
    return TopicChatQuery.objects.filter(
        user=user,
        created_at__gte=_today_start(),
    ).count()


def daily_quota_payload(user) -> dict:
    """Serialisable quota snapshot for API responses."""
    limit = user_daily_consultation_limit(user)
    used = count_user_consultations_today(user)
    if limit is None:
        return {
            'daily_limit': None,
            'daily_used': used,
            'daily_remaining': None,
            'tokens_url': TOKENS_PROFILE_PATH,
        }
    return {
        'daily_limit': limit,
        'daily_used': used,
        'daily_remaining': max(0, limit - used),
        'tokens_url': TOKENS_PROFILE_PATH,
    }


def daily_quota_exceeded_payload(user) -> dict | None:
    """
    If the user is over their daily free limit, return an error body; else None.

    Call before running RAG so OpenAI/Qdrant spend is avoided when capped.
    """
    limit = user_daily_consultation_limit(user)
    if limit is None:
        return None
    used = count_user_consultations_today(user)
    if used < limit:
        return None
    return {
        'error': (
            f'Has alcanzado el límite de {limit} consultas gratuitas por día. '
            'Compra tokens ACBC para seguir creando consultas.'
        ),
        'code': 'daily_consultation_limit',
        'daily_limit': limit,
        'daily_used': used,
        'daily_remaining': 0,
        'tokens_url': TOKENS_PROFILE_PATH,
    }
