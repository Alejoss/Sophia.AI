import json
import unicodedata


def to_ascii_safe(text: str) -> str:
    """Strip non-ASCII characters (needed when Postgres uses SQL_ASCII encoding)."""
    if text is None:
        return ''
    normalized = unicodedata.normalize('NFKD', str(text))
    return normalized.encode('ascii', 'ignore').decode('ascii').strip()


def to_ascii_safe_json(obj):
    """JSON-safe for SQL_ASCII databases (unicode escaped as \\uXXXX)."""
    return json.loads(json.dumps(obj, ensure_ascii=True))
