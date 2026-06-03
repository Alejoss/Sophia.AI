import io
import logging
import os

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from PIL import Image

logger = logging.getLogger('academia_blockchain.content.image_utils')

# Max dimensions for the listing thumbnail. Cards render ~140px tall and at most
# ~1/3 of the viewport wide, so 480px covers retina without shipping the 2MB original.
TOPIC_THUMB_MAX_WIDTH = 480
TOPIC_THUMB_MAX_HEIGHT = 320
TOPIC_THUMB_QUALITY = 80
TOPIC_THUMB_FILENAME = 'topic_image_thumb.webp'

# Cover uploads (topic + knowledge path); keep in sync with ImageUploadModal.jsx
COVER_IMAGE_MAX_BYTES = 3 * 1024 * 1024


def validate_cover_image_size(uploaded_file):
    """Raise ValueError if the uploaded cover exceeds COVER_IMAGE_MAX_BYTES."""
    if uploaded_file and getattr(uploaded_file, 'size', 0) > COVER_IMAGE_MAX_BYTES:
        raise ValueError('La imagen no debe superar 3 MB.')


def _s3_public_domain():
    """Public bucket host for reading media (works in dev when DB points at S3 keys)."""
    domain = getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', None)
    if domain:
        return domain.rstrip('/')
    bucket = os.getenv('AWS_STORAGE_BUCKET_NAME', 'academiablockchain')
    region = os.getenv('AWS_S3_REGION_NAME', 'us-west-2')
    if bucket:
        return f'{bucket}.s3.{region}.amazonaws.com'
    return None


def read_topic_image_bytes(topic):
    """Load original cover bytes from storage or, if missing locally, from public S3.

    Returns None when the source file cannot be read; callers should treat that as
    non-fatal and continue (log only, do not raise).
    """
    if not topic.topic_image:
        return None

    name = topic.topic_image.name
    storage = topic.topic_image.storage

    try:
        if storage.exists(name):
            with topic.topic_image.open('rb') as f:
                return f.read()
    except (OSError, FileNotFoundError) as e:
        logger.warning(
            'Topic cover not readable from storage topic_id=%s path=%s: %s',
            topic.id,
            name,
            e,
        )

    domain = _s3_public_domain()
    if domain:
        url = f'https://{domain}/{name.lstrip("/")}'
        try:
            response = requests.get(url, timeout=60)
            if response.status_code == 200:
                logger.info('Fetched topic image from S3 for thumbnail topic_id=%s', topic.id)
                return response.content
            logger.warning(
                'Topic cover missing on S3 (HTTP %s) topic_id=%s path=%s',
                response.status_code,
                topic.id,
                name,
            )
        except requests.RequestException as e:
            logger.warning(
                'Topic cover S3 fetch failed topic_id=%s path=%s: %s',
                topic.id,
                name,
                e,
            )
    else:
        logger.warning(
            'Topic cover missing locally and S3 is not configured topic_id=%s path=%s',
            topic.id,
            name,
        )

    return None


def generate_topic_thumbnail(topic, save=True):
    """Create/refresh ``topic.topic_image_thumbnail`` from ``topic.topic_image``.

    Never raises. Returns True if a thumbnail was generated, False if skipped
    (missing source, corrupt image, etc.). Uploads and batch commands must continue.
    """
    if not topic.topic_image:
        return False

    try:
        data = read_topic_image_bytes(topic)
        if not data:
            # read_topic_image_bytes already logged why the source is missing.
            return False

        img = Image.open(io.BytesIO(data))
        # WebP supports alpha; flatten only exotic modes (palette, CMYK, etc.).
        if img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGBA' if 'A' in img.getbands() else 'RGB')

        img.thumbnail(
            (TOPIC_THUMB_MAX_WIDTH, TOPIC_THUMB_MAX_HEIGHT),
            Image.Resampling.LANCZOS,
        )

        buffer = io.BytesIO()
        img.save(buffer, format='WEBP', quality=TOPIC_THUMB_QUALITY, method=6)
        buffer.seek(0)

        topic.topic_image_thumbnail.save(
            TOPIC_THUMB_FILENAME,
            ContentFile(buffer.read()),
            save=save,
        )
        logger.info('Generated topic thumbnail topic_id=%s', topic.id)
        return True
    except Exception as e:
        logger.warning(
            'Skipped topic thumbnail (processing failed) topic_id=%s path=%s: %s',
            topic.id,
            getattr(topic.topic_image, 'name', ''),
            e,
        )
        return False


def delete_topic_thumbnail(topic, save=False):
    """Remove the stored thumbnail file (if any) without deleting the original."""
    if topic.topic_image_thumbnail:
        try:
            topic.topic_image_thumbnail.delete(save=save)
        except Exception as e:
            logger.warning("Failed deleting topic thumbnail topic_id=%s: %s", topic.id, e)
