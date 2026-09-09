"""Daily consultation (TopicChatQuery) quotas per user.

Free users are capped; premium / token entitlements can return unlimited later
via ``user_daily_consultation_limit``.
"""

from __future__ import annotations

from django.utils import timezone

from content.models import TopicChatQuery


def user_daily_consultation_limit(user) -> int | None:
    """
    Max consultations per calendar day (server local midnight).

    Returns None for unlimited (reserved for future premium / paid tokens).
    """
    # Future: if the user has an active premium/token entitlement, return None.
    _ = user
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
        }
    return {
        'daily_limit': limit,
        'daily_used': used,
        'daily_remaining': max(0, limit - used),
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
            f'Has alcanzado el límite de {limit} consultas por día. '
            'Podrás hacer más consultas mañana.'
        ),
        'code': 'daily_consultation_limit',
        'daily_limit': limit,
        'daily_used': used,
        'daily_remaining': 0,
    }
