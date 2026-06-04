"""Helpers for YouTube URL → local file → S3 owner-attach migration."""
import re
from typing import Optional

import requests

from content.s3_key_utils import sanitize_filename_for_s3_key

YOUTUBE_HOST_MARKERS = ('youtube.com', 'youtu.be')

# Truncation limits for migration filenames
CHANNEL_LABEL_MAX = 40
TITLE_LABEL_MAX = 60


def is_youtube_url(url: Optional[str]) -> bool:
    if not url:
        return False
    lower = url.lower()
    return any(marker in lower for marker in YOUTUBE_HOST_MARKERS)


def extract_youtube_video_id(url: str) -> Optional[str]:
    if not url:
        return None
    patterns = [
        r'youtube\.com/watch\?v=([^&]+)',
        r'youtu\.be/([^?/]+)',
        r'youtube\.com/embed/([^?/]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url, re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def fetch_youtube_channel_from_oembed(url: str, timeout: int = 5) -> Optional[str]:
    """Return channel/uploader name via YouTube oEmbed (author_name)."""
    video_id = extract_youtube_video_id(url)
    if not video_id:
        return None
    oembed_url = (
        f'https://www.youtube.com/oembed?url='
        f'https://www.youtube.com/watch?v={video_id}&format=json'
    )
    try:
        response = requests.get(oembed_url, timeout=timeout)
        if response.status_code == 200:
            return (response.json().get('author_name') or '').strip() or None
    except requests.RequestException:
        return None
    return None


def sanitize_migration_label(text: str, max_length: int) -> str:
    """Filesystem-safe slug segment (ASCII-ish, underscores)."""
    if not text:
        return 'unknown'
    value = str(text).strip()
    value = re.sub(r'[^\w\s-]', '', value, flags=re.UNICODE)
    value = re.sub(r'[\s_]+', '_', value).strip('_')
    if not value:
        value = 'unknown'
    if len(value) > max_length:
        value = value[:max_length].rstrip('_')
    return value or 'unknown'


def build_migration_filename(
    channel: str,
    title: str,
    content_id: int,
    ext: str = 'mp4',
) -> str:
    """
    Pattern: {channel}_{title}_{content_id}.{ext}
    Channel and title are truncated; content_id is always present for linking.
    """
    channel_part = sanitize_migration_label(channel, CHANNEL_LABEL_MAX)
    title_part = sanitize_migration_label(title, TITLE_LABEL_MAX)
    ext = (ext or 'mp4').lstrip('.').lower() or 'mp4'
    raw = f'{channel_part}_{title_part}_{content_id}.{ext}'
    return sanitize_filename_for_s3_key(raw)


def owner_attach_s3_key_prefix(content_id: int, user_id: int) -> str:
    return f'content_owner_attach/{content_id}/{user_id}/'


def build_migration_s3_key(filename: str, content_id: int, user_id: int) -> str:
    safe_name = sanitize_filename_for_s3_key(filename)
    return f'{owner_attach_s3_key_prefix(content_id, user_id)}{safe_name}'


def parse_content_id_from_migration_filename(filename: str) -> Optional[int]:
    """Parse trailing _{content_id} before extension."""
    name = filename.rsplit('/', 1)[-1]
    stem, _ext = (name.rsplit('.', 1) + [''])[:2]
    match = re.search(r'_(\d+)$', stem)
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def resolve_youtube_channel(
    youtube_url: str,
    *,
    content_author: Optional[str] = None,
    profile_author: Optional[str] = None,
    use_oembed: bool = False,
) -> str:
    """
    Best-effort channel label for filenames.

    Default skips oEmbed (manifest must return fast). Use use_oembed=True only
    for single-item tooling; bulk channel names come from the local download script.
    """
    if use_oembed:
        channel = fetch_youtube_channel_from_oembed(youtube_url)
        if channel:
            return channel
    for candidate in (profile_author, content_author):
        if candidate and str(candidate).strip():
            return str(candidate).strip()
    return 'UnknownChannel'


def content_can_owner_attach_file(content, user) -> tuple[bool, int]:
    """Mirror owner-attach rules; returns (ok, other_profiles_count)."""
    if not user or content.uploaded_by_id != user.id:
        return False, 0
    if not content.url:
        return False, 0
    fd = getattr(content, 'file_details', None)
    if fd is None:
        try:
            from content.models import FileDetails
            fd = FileDetails.objects.filter(content=content).first()
        except Exception:
            fd = None
    if fd and fd.file:
        return False, 0
    other_count = content.get_other_user_profiles_count()
    if not content.can_be_modified_by(user):
        return False, other_count
    return True, other_count
