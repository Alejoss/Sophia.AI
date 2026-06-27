"""Backward-compatible re-exports. Prefer utils.db_encoding.prepare_* for new code."""

from utils.db_encoding import to_ascii_safe, to_ascii_safe_json

__all__ = ['to_ascii_safe', 'to_ascii_safe_json']
