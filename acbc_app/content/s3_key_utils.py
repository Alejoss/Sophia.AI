"""Helpers for S3 object keys (no Django model imports — safe for models.py)."""
import os


def sanitize_filename_for_s3_key(filename, max_length=200):
    """
    Normalize a user-supplied filename for the suffix of an S3 key.

    - Uses basename only (no path components).
    - Replaces spaces with underscores.
    - Strips trailing dots from the name stem so "file..mp4" becomes "file.mp4".
    """
    name = os.path.basename(str(filename or 'file'))
    name = name.replace(' ', '_').replace('\\', '_').replace('/', '_')
    stem, ext = os.path.splitext(name)
    stem = stem.rstrip('.')
    if not stem:
        stem = 'file'
    name = f"{stem}{ext}" if ext else stem
    name = name[:max_length]
    if not name or name in ('.', '..'):
        return 'file'
    return name


def is_unsafe_s3_key(key):
    """True if key is absolute or contains path-traversal segments (not literal '..' inside a filename)."""
    if not key or key.startswith('/'):
        return True
    for part in key.replace('\\', '/').split('/'):
        if part in ('.', '..'):
            return True
    return False
