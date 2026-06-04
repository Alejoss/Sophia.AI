"""Write YouTube migration manifest JSON for a user (same data as the open API)."""
import json
from pathlib import Path

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from content.models import ContentProfile
from content.views import normalize_youtube_url
from content.youtube_migration_utils import (
    build_migration_filename,
    build_migration_s3_key,
    content_can_owner_attach_file,
    is_youtube_url,
    resolve_youtube_channel,
)


class Command(BaseCommand):
    help = 'Export YouTube migration manifest JSON for user_id (local file).'

    def add_arguments(self, parser):
        parser.add_argument('--user-id', type=int, required=True)
        parser.add_argument(
            '--output',
            type=str,
            default='',
            help='Output path (default: youtube_migration/manifest_user_<id>.json)',
        )

    def handle(self, *args, **options):
        user_id = options['user_id']
        user = User.objects.filter(pk=user_id).first()
        if not user:
            self.stderr.write(self.style.ERROR(f'User id={user_id} not found'))
            return

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

        payload = {
            'user_id': user_id,
            'username': user.username,
            'generated_at': timezone.now().isoformat(),
            'item_count': len(items),
            'items': items,
        }

        out = options['output'] or f'youtube_migration/manifest_user_{user_id}.json'
        out_path = Path(out)
        if not out_path.is_absolute():
            from django.conf import settings
            out_path = Path(settings.BASE_DIR) / out_path
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open('w', encoding='utf-8') as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)

        self.stdout.write(
            self.style.SUCCESS(f'Wrote {len(items)} items to {out_path}')
        )
