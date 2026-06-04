"""Open manifest endpoint for local YouTube → S3 migration (no auth)."""
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import ContentProfile
from content.views import normalize_youtube_url
from content.youtube_migration_utils import (
    build_migration_filename,
    build_migration_s3_key,
    content_can_owner_attach_file,
    is_youtube_url,
    resolve_youtube_channel,
)


class YouTubeMigrationManifestView(APIView):
    """
    GET /api/content/youtube-migration-manifest/?user_id=1

    Public read-only list of YouTube URL contents for a user (local migration tooling).
    """

    permission_classes = [AllowAny]

    def get(self, request):
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response({'error': 'user_id query parameter is required'}, status=400)
        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            return Response({'error': 'user_id must be an integer'}, status=400)

        user = User.objects.filter(pk=user_id).first()
        if not user:
            return Response({'error': f'User id={user_id} not found'}, status=404)

        profiles = (
            ContentProfile.objects.filter(user_id=user_id, content__uploaded_by_id=user_id)
            .select_related('content', 'content__file_details', 'collection')
            .order_by('id')
        )

        items = []
        for profile in profiles:
            content = profile.content
            raw_url = content.url
            if not is_youtube_url(raw_url):
                continue

            youtube_url = normalize_youtube_url(raw_url)
            fd = getattr(content, 'file_details', None)
            has_file = bool(fd and fd.file)

            can_attach, other_count = content_can_owner_attach_file(content, user)
            display_title = profile.title or content.original_title or 'video'
            channel = resolve_youtube_channel(
                youtube_url,
                content_author=content.original_author,
                profile_author=profile.author,
            )
            suggested_local_filename = build_migration_filename(
                channel, display_title, content.id, ext='mp4'
            )
            suggested_s3_key = build_migration_s3_key(
                suggested_local_filename, content.id, user_id
            )

            items.append({
                'content_id': content.id,
                'content_profile_id': profile.id,
                'youtube_url': youtube_url,
                'youtube_channel': channel,
                'title': display_title,
                'collection_id': profile.collection_id,
                'collection_name': profile.collection.name if profile.collection else None,
                'media_type': content.media_type,
                'has_file': has_file,
                'can_attach_file': can_attach and not has_file,
                'other_profiles_count': other_count,
                'suggested_local_filename': suggested_local_filename,
                'suggested_s3_key': suggested_s3_key,
            })

        return Response({
            'user_id': user_id,
            'username': user.username,
            'generated_at': timezone.now().isoformat(),
            'item_count': len(items),
            'items': items,
        })
