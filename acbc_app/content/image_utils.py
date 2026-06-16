import io
import logging
import os

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from PIL import Image

logger = logging.getLogger('academia_blockchain.content.image_utils')

# Listing/card display (~480px covers retina in ContentDisplay and topic grids).
LISTING_THUMB_MAX_WIDTH = 480
LISTING_THUMB_MAX_HEIGHT = 320
LISTING_THUMB_QUALITY = 80

# Backwards-compatible aliases for topic cover code.
TOPIC_THUMB_MAX_WIDTH = LISTING_THUMB_MAX_WIDTH
TOPIC_THUMB_MAX_HEIGHT = LISTING_THUMB_MAX_HEIGHT
TOPIC_THUMB_QUALITY = LISTING_THUMB_QUALITY
TOPIC_THUMB_FILENAME = 'topic_image_thumb.webp'
CONTENT_PROFILE_THUMB_PREVIEW_FILENAME = 'preview.webp'

# Cover uploads (topic + knowledge path); keep in sync with ImageUploadModal.jsx
COVER_IMAGE_MAX_BYTES = 3 * 1024 * 1024
# Custom ContentProfile thumbnail uploads use the same limit.
CONTENT_PROFILE_THUMB_MAX_BYTES = COVER_IMAGE_MAX_BYTES


def validate_cover_image_size(uploaded_file):
    """Raise ValueError if the uploaded image exceeds COVER_IMAGE_MAX_BYTES."""
    if uploaded_file and getattr(uploaded_file, 'size', 0) > COVER_IMAGE_MAX_BYTES:
        raise ValueError('La imagen no debe superar 3 MB.')


def validate_content_profile_thumbnail_size(uploaded_file):
    """Raise ValueError if the uploaded profile thumbnail exceeds the limit."""
    if uploaded_file and getattr(uploaded_file, 'size', 0) > CONTENT_PROFILE_THUMB_MAX_BYTES:
        raise ValueError('La imagen no debe superar 3 MB.')


def validate_image_bytes(data, max_bytes=CONTENT_PROFILE_THUMB_MAX_BYTES):
    """Raise ValueError if bytes are empty, too large, or not a readable image."""
    if not data:
        raise ValueError('El archivo de imagen está vacío.')
    if len(data) > max_bytes:
        raise ValueError('La imagen no debe superar 3 MB.')
    try:
        with Image.open(io.BytesIO(data)) as img:
            img.verify()
    except Exception as exc:
        raise ValueError(f'No es una imagen válida: {exc}') from exc


def _s3_public_domain():
    domain = getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', None)
    if domain:
        return domain.rstrip('/')
    bucket = os.getenv('AWS_STORAGE_BUCKET_NAME', 'academiablockchain')
    region = os.getenv('AWS_S3_REGION_NAME', 'us-west-2')
    if bucket:
        return f'{bucket}.s3.{region}.amazonaws.com'
    return None


def read_image_field_bytes(file_field, log_label='image'):
    """Load bytes from a stored ImageField, with S3 fallback. Never raises."""
    if not file_field:
        return None

    name = file_field.name
    storage = file_field.storage

    try:
        if storage.exists(name):
            with file_field.open('rb') as f:
                return f.read()
    except (OSError, FileNotFoundError) as e:
        logger.warning('%s not readable from storage path=%s: %s', log_label, name, e)

    domain = _s3_public_domain()
    if domain:
        url = f'https://{domain}/{name.lstrip("/")}'
        try:
            response = requests.get(url, timeout=60)
            if response.status_code == 200:
                logger.info('Fetched %s from S3 path=%s', log_label, name)
                return response.content
            logger.warning(
                '%s missing on S3 (HTTP %s) path=%s', log_label, response.status_code, name
            )
        except requests.RequestException as e:
            logger.warning('%s S3 fetch failed path=%s: %s', log_label, name, e)
    else:
        logger.warning('%s missing locally and S3 not configured path=%s', log_label, name)

    return None


def read_topic_image_bytes(topic):
    if not topic.topic_image:
        return None
    return read_image_field_bytes(
        topic.topic_image,
        log_label=f'topic cover topic_id={topic.id}',
    )


def _bytes_to_listing_webp(data):
    img = Image.open(io.BytesIO(data))
    if img.mode not in ('RGB', 'RGBA'):
        img = img.convert('RGBA' if 'A' in img.getbands() else 'RGB')
    img.thumbnail(
        (LISTING_THUMB_MAX_WIDTH, LISTING_THUMB_MAX_HEIGHT),
        Image.Resampling.LANCZOS,
    )
    buffer = io.BytesIO()
    img.save(buffer, format='WEBP', quality=LISTING_THUMB_QUALITY, method=6)
    buffer.seek(0)
    return buffer.read()


def save_listing_preview_from_field(instance, source_attr, dest_attr, dest_filename, save=True, log_context=''):
    """Generate a WebP listing preview on ``dest_attr`` from ``source_attr``. Never raises."""
    source = getattr(instance, source_attr, None)
    if not source:
        return False

    try:
        data = read_image_field_bytes(source, log_label=log_context or source_attr)
        if not data:
            return False

        dest_field = getattr(instance, dest_attr)
        dest_field.save(
            dest_filename,
            ContentFile(_bytes_to_listing_webp(data)),
            save=save,
        )
        logger.info('Generated listing preview %s for %s', dest_attr, log_context or instance.pk)
        return True
    except Exception as e:
        logger.warning(
            'Skipped listing preview %s for %s path=%s: %s',
            dest_attr,
            log_context or getattr(instance, 'pk', '?'),
            getattr(source, 'name', ''),
            e,
        )
        return False


def delete_image_field(instance, field_attr, save=False):
    field = getattr(instance, field_attr, None)
    if field:
        try:
            field.delete(save=save)
        except Exception as e:
            logger.warning('Failed deleting %s: %s', field_attr, e)


def generate_topic_thumbnail(topic, save=True):
    return save_listing_preview_from_field(
        topic,
        'topic_image',
        'topic_image_thumbnail',
        TOPIC_THUMB_FILENAME,
        save=save,
        log_context=f'topic_id={topic.id}',
    )


def delete_topic_thumbnail(topic, save=False):
    delete_image_field(topic, 'topic_image_thumbnail', save=save)


def generate_content_profile_thumbnail_preview(profile, save=True):
    return save_listing_preview_from_field(
        profile,
        'thumbnail',
        'thumbnail_preview',
        CONTENT_PROFILE_THUMB_PREVIEW_FILENAME,
        save=save,
        log_context=f'content_profile_id={profile.id}',
    )


def delete_content_profile_thumbnail_preview(profile, save=False):
    delete_image_field(profile, 'thumbnail_preview', save=save)


def generate_knowledge_path_image_preview(knowledge_path, save=True):
    return save_listing_preview_from_field(
        knowledge_path,
        'image',
        'image_preview',
        f'path_{knowledge_path.id}_preview.webp',
        save=save,
        log_context=f'knowledge_path_id={knowledge_path.id}',
    )


def delete_knowledge_path_image_preview(knowledge_path, save=False):
    delete_image_field(knowledge_path, 'image_preview', save=save)
