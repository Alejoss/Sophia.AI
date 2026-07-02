"""Short-lived cache for unread notification counts (reduces repeated COUNT queries)."""
from django.core.cache import cache

UNREAD_COUNT_CACHE_TTL_SECONDS = 30


def unread_count_cache_key(user_id: int) -> str:
    return f'notifications:unread_count:{user_id}'


def get_cached_unread_count(user_id: int):
    return cache.get(unread_count_cache_key(user_id))


def set_cached_unread_count(user_id: int, count: int) -> None:
    cache.set(unread_count_cache_key(user_id), count, UNREAD_COUNT_CACHE_TTL_SECONDS)


def invalidate_unread_count(user_id: int) -> None:
    cache.delete(unread_count_cache_key(user_id))
