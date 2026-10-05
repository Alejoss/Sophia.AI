"""
Build Open Graph / Twitter Card metadata for social crawlers (Telegram, etc.).

The React SPA does not emit per-page meta tags in the initial HTML, so link
previews must come from this server-rendered document.
"""
from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Prefetch

from content.models import Content, ContentProfile, FileDetails, Publication, Topic
from content.utils import build_media_url
from knowledge_paths.models import KnowledgePath

SITE_NAME = 'Academia Blockchain'
DEFAULT_DESCRIPTION = (
    'Biblioteca, temas y aprendizaje sobre Bitcoin, blockchain y cultura digital.'
)
DEFAULT_IMAGE_PATH = '/images/home_hero_brand_v2.png'
MEDIA_TYPE_LABELS = {
    'VIDEO': 'Video',
    'AUDIO': 'Audio',
    'TEXT': 'Texto',
    'IMAGE': 'Imagen',
}


@dataclass(frozen=True)
class SocialPreviewMeta:
    title: str
    description: str
    image_url: str
    page_url: str
    canonical_path: str
    og_type: str = 'website'
    site_name: str = SITE_NAME


def _frontend_base_url(request) -> str:
    configured = (getattr(settings, 'FRONTEND_PUBLIC_URL', None) or '').rstrip('/')
    if configured:
        return configured
    return request.build_absolute_uri('/').rstrip('/')


def absolute_frontend_url(request, path: str) -> str:
    if not path:
        path = '/'
    if path.startswith('http://') or path.startswith('https://'):
        return path
    if not path.startswith('/'):
        path = f'/{path}'
    return f'{_frontend_base_url(request)}{path}'


def _truncate(text: str | None, limit: int = 300) -> str:
    if not text:
        return ''
    cleaned = ' '.join(str(text).split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1].rstrip() + '…'


def resolve_content_profile_for_social(content: Content, request):
    """
    Resolve a ContentProfile for OG tags using the same visibility rules as
    ContentDetailView.get_content_profile (anonymous-safe).
    """
    context = request.GET.get('context')
    context_id = request.GET.get('id')
    if not context or not context_id:
        return None

    try:
        context_id_int = int(context_id)
    except (TypeError, ValueError):
        return None

    try:
        if context == 'topic':
            topic = Topic.objects.get(id=context_id_int)
            if not topic.can_be_viewed_by(request.user):
                return None
            return ContentProfile.objects.get(content=content, user=topic.creator)

        if context == 'library':
            library_owner = User.objects.get(id=context_id_int)
            profile = ContentProfile.objects.select_related('collection').get(
                content=content, user=library_owner
            )
            is_self_or_staff = (
                request.user.is_authenticated
                and (context_id_int == request.user.id or request.user.is_staff)
            )
            collection = profile.collection
            is_public_item = (
                profile.is_visible
                and collection is not None
                and collection.is_public
            )
            if is_self_or_staff or is_public_item:
                return profile
            return None

        if context == 'search':
            profile = ContentProfile.objects.select_related('collection').get(
                pk=context_id_int,
                content=content,
            )
            if profile.is_visible:
                return profile
            if request.user.is_authenticated and (
                profile.user_id == request.user.id or request.user.is_staff
            ):
                return profile
            return None

        if context == 'publication':
            publication = Publication.objects.get(id=context_id_int)
            return ContentProfile.objects.get(content=content, user=publication.user)

        if context == 'knowledge_path':
            path = KnowledgePath.objects.get(id=context_id_int)
            return ContentProfile.objects.get(content=content, user=path.author)
    except (
        Topic.DoesNotExist,
        User.DoesNotExist,
        Publication.DoesNotExist,
        KnowledgePath.DoesNotExist,
        ContentProfile.DoesNotExist,
    ):
        return None

    return None


def _content_canonical_path(content_id: int, request) -> str:
    context = request.GET.get('context')
    context_id = request.GET.get('id')
    path = f'/content/{content_id}/library'
    if context == 'topic' and context_id:
        path = f'/content/{content_id}/topic/{context_id}'
        return path
    query = {}
    if context and context_id:
        query['context'] = context
        query['id'] = context_id
    if query:
        path = f'{path}?{urlencode(query)}'
    return path


def _content_image_url(content: Content, profile: ContentProfile | None, request) -> str:
    if profile is not None:
        if profile.thumbnail:
            url = build_media_url(profile.thumbnail, request)
            if url:
                return url
        if profile.thumbnail_preview:
            url = build_media_url(profile.thumbnail_preview, request)
            if url:
                return url

    file_details = getattr(content, 'file_details', None)
    if file_details is None:
        try:
            file_details = content.file_details
        except FileDetails.DoesNotExist:
            file_details = None
    if file_details and file_details.og_image:
        og_image = file_details.og_image.strip()
        if og_image.startswith('http://') or og_image.startswith('https://'):
            return og_image
        return absolute_frontend_url(request, og_image)

    return absolute_frontend_url(request, DEFAULT_IMAGE_PATH)


def _content_description(content: Content, profile: ContentProfile | None) -> str:
    file_details = getattr(content, 'file_details', None)
    if file_details is None:
        try:
            file_details = content.file_details
        except FileDetails.DoesNotExist:
            file_details = None

    if file_details and file_details.og_description:
        return _truncate(file_details.og_description)

    author = None
    if profile is not None and profile.display_author:
        author = profile.display_author
    elif content.original_author:
        author = content.original_author

    media_label = MEDIA_TYPE_LABELS.get(content.media_type, 'Contenido')
    if author:
        return _truncate(f'{media_label} de {author} en {SITE_NAME}.')
    return _truncate(f'{media_label} en {SITE_NAME}.')


def build_content_social_preview(content: Content, request) -> SocialPreviewMeta:
    profile = resolve_content_profile_for_social(content, request)
    title = (
        profile.display_title
        if profile is not None and profile.display_title
        else (content.original_title or f'Contenido #{content.id}')
    )
    canonical_path = _content_canonical_path(content.id, request)
    return SocialPreviewMeta(
        title=_truncate(title, 110),
        description=_content_description(content, profile),
        image_url=_content_image_url(content, profile, request),
        page_url=absolute_frontend_url(request, canonical_path),
        canonical_path=canonical_path,
        og_type='article',
    )


def build_topic_social_preview(topic: Topic, request) -> SocialPreviewMeta | None:
    if not topic.can_be_viewed_by(request.user):
        return None

    image_url = None
    if topic.topic_image:
        image_url = build_media_url(topic.topic_image, request)
    if not image_url and topic.topic_image_thumbnail:
        image_url = build_media_url(topic.topic_image_thumbnail, request)
    if not image_url:
        image_url = absolute_frontend_url(request, DEFAULT_IMAGE_PATH)

    description = _truncate(topic.description) or DEFAULT_DESCRIPTION
    canonical_path = f'/content/topics/{topic.id}'
    return SocialPreviewMeta(
        title=_truncate(topic.title, 110),
        description=description,
        image_url=image_url,
        page_url=absolute_frontend_url(request, canonical_path),
        canonical_path=canonical_path,
        og_type='website',
    )


def build_site_social_preview(request, canonical_path: str = '/') -> SocialPreviewMeta:
    return SocialPreviewMeta(
        title=SITE_NAME,
        description=DEFAULT_DESCRIPTION,
        image_url=absolute_frontend_url(request, DEFAULT_IMAGE_PATH),
        page_url=absolute_frontend_url(request, canonical_path),
        canonical_path=canonical_path,
        og_type='website',
    )


def get_content_for_social_preview(content_id: int) -> Content | None:
    try:
        return (
            Content.objects.select_related('file_details')
            .prefetch_related(
                Prefetch(
                    'profiles',
                    queryset=ContentProfile.objects.select_related('collection', 'user'),
                )
            )
            .get(pk=content_id)
        )
    except Content.DoesNotExist:
        return None
