"""
Database text encoding helpers.

Production should use PostgreSQL with UTF8 server encoding so user input (accents,
Spanish text, etc.) is stored as-is. Legacy SQL_ASCII clusters are detected at
runtime and text is degraded only when necessary until the DB is migrated.
"""

from __future__ import annotations

import json
import logging
import unicodedata
from typing import Any

logger = logging.getLogger(__name__)

_encoding_cache: dict[str, str] | None = None


def clear_encoding_cache() -> None:
    """Reset cached encoding (useful in tests)."""
    global _encoding_cache
    _encoding_cache = None


def get_postgres_encodings() -> dict[str, str] | None:
    """
    Return {'server': ..., 'client': ...} for the default PostgreSQL connection.
    Returns None for non-PostgreSQL backends (e.g. SQLite in tests).
    """
    global _encoding_cache
    if _encoding_cache is not None:
        return _encoding_cache

    from django.db import connection

    if connection.vendor != 'postgresql':
        return None

    with connection.cursor() as cursor:
        cursor.execute('SHOW SERVER_ENCODING')
        server = cursor.fetchone()[0]
        cursor.execute('SHOW CLIENT_ENCODING')
        client = cursor.fetchone()[0]

    _encoding_cache = {'server': server, 'client': client}
    return _encoding_cache


def is_sql_ascii_database() -> bool:
    encodings = get_postgres_encodings()
    return encodings is not None and encodings.get('server') == 'SQL_ASCII'


def warn_if_sql_ascii_database() -> None:
    """Log a critical warning when the DB cannot store Unicode natively."""
    encodings = get_postgres_encodings()
    if encodings is None:
        return
    if encodings.get('server') == 'SQL_ASCII':
        logger.critical(
            'PostgreSQL server encoding is SQL_ASCII. Unicode user input will fail or '
            'be degraded. Migrate the database to UTF8: ./scripts/migrate-db-to-utf8.sh'
        )
    elif encodings.get('server') != 'UTF8':
        logger.warning(
            'Unexpected PostgreSQL server encoding: %s (expected UTF8)',
            encodings.get('server'),
        )


def to_ascii_safe(text: str) -> str:
    """Strip non-ASCII characters (legacy SQL_ASCII fallback only)."""
    if text is None:
        return ''
    normalized = unicodedata.normalize('NFKD', str(text))
    return normalized.encode('ascii', 'ignore').decode('ascii').strip()


def to_ascii_safe_json(obj: Any) -> Any:
    """Recursively strip non-ASCII from strings inside JSON-like structures."""
    return _ascii_safe_structure(obj)


def _ascii_safe_structure(obj: Any) -> Any:
    if isinstance(obj, str):
        return to_ascii_safe(obj)
    if isinstance(obj, dict):
        return {str(key): _ascii_safe_structure(value) for key, value in obj.items()}
    if isinstance(obj, list):
        return [_ascii_safe_structure(item) for item in obj]
    if isinstance(obj, tuple):
        return tuple(_ascii_safe_structure(item) for item in obj)
    return obj


def prepare_text_for_db(text: str | None) -> str:
    """
    Return text safe to persist in the active database encoding.
    UTF8 databases store the original string; SQL_ASCII degrades accents.
    """
    if text is None:
        return ''
    text = str(text)
    if is_sql_ascii_database():
        return to_ascii_safe(text)
    return text


def prepare_json_for_db(obj: Any) -> Any:
    """
    Return JSON-serializable data safe for the active database encoding.
    UTF8 databases store the original structure; SQL_ASCII escapes non-ASCII.
    """
    if obj is None:
        return {}
    if is_sql_ascii_database():
        return _ascii_safe_structure(obj)
    return obj


def normalize_notes_value(notes: Any) -> str:
    """Normalize certificate request notes from API input to plain text."""
    if notes is None or notes == '':
        return ''
    if isinstance(notes, str):
        return notes.strip()
    if isinstance(notes, dict):
        message = notes.get('message')
        if message is not None:
            return str(message).strip()
        if not notes:
            return ''
        return json.dumps(notes, ensure_ascii=False)
    return str(notes).strip()
