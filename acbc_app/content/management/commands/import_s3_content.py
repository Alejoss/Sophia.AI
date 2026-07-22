"""
Import files already uploaded to S3 into a user's library/collection.

Creates Content / ContentProfile / FileDetails the same way as
UploadContentConfirmView, then sets FileDetails.file via queryset.update
so Django never re-uploads the blob.
"""
import os
import re

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from content.models import Library, Collection, Content, ContentProfile, FileDetails
from content.s3_key_utils import is_unsafe_s3_key

EXTENSION_MAP = {
    'VIDEO': {'mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'},
    'AUDIO': {'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'},
    'IMAGE': {'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'},
    'TEXT': {'pdf', 'txt', 'md', 'doc', 'docx', 'epub'},
}

MEDIA_TYPES = tuple(EXTENSION_MAP.keys())


def extension_of(key):
    ext = key.rsplit('.', 1)[-1].lower() if '.' in key.rsplit('/', 1)[-1] else ''
    return ext


def matches_media_type(key, media_type):
    return extension_of(key) in EXTENSION_MAP[media_type]


def sanitize_title(raw, max_length=255):
    """Basic display-title sanitize: collapse whitespace, strip, truncate."""
    title = re.sub(r'\s+', ' ', str(raw or '').strip())
    if not title:
        title = 'untitled'
    return title[:max_length]


def title_from_key(key, title_from='filename'):
    if title_from == 'key':
        return sanitize_title(key)
    filename = key.rsplit('/', 1)[-1]
    name_no_ext = os.path.splitext(filename)[0]
    return sanitize_title(name_no_ext)


class Command(BaseCommand):
    help = (
        'Import existing S3 objects under a prefix into a user library/collection '
        'without re-uploading blobs.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-id',
            type=int,
            required=True,
            help='User ID that owns Library / ContentProfile / uploaded_by.',
        )
        parser.add_argument(
            '--prefix',
            type=str,
            required=True,
            help='S3 prefix to list (trailing slash will be added if missing).',
        )
        parser.add_argument(
            '--collection-name',
            type=str,
            default=None,
            help='Collection name; get_or_create under the user Library.',
        )
        parser.add_argument(
            '--collection-id',
            type=int,
            default=None,
            help='Existing Collection ID (must belong to the user Library). Takes priority over --collection-name.',
        )
        parser.add_argument(
            '--media-type',
            type=str,
            required=True,
            choices=MEDIA_TYPES,
            help='Media type for created Content rows.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='List keys/titles that would be imported; do not write to the DB.',
        )
        parser.add_argument(
            '--title-from',
            type=str,
            choices=['filename', 'key'],
            default='filename',
            help='How to derive original_title/title (default: filename).',
        )

    def handle(self, *args, **options):
        user_id = options['user_id']
        prefix = options['prefix']
        collection_id = options['collection_id']
        collection_name = options['collection_name']
        media_type = options['media_type']
        dry_run = options['dry_run']
        title_from = options['title_from']

        if not collection_id and not collection_name:
            raise CommandError('Provide --collection-id or --collection-name.')

        user = User.objects.filter(pk=user_id).first()
        if not user:
            raise CommandError(f'User id={user_id} not found.')

        if not getattr(settings, 'AWS_ACCESS_KEY_ID', None) or not getattr(settings, 'AWS_SECRET_ACCESS_KEY', None):
            raise CommandError('AWS credentials not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).')

        try:
            import boto3
        except ImportError as exc:
            raise CommandError('boto3 required: pip install boto3') from exc

        bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'academiablockchain')
        region = getattr(settings, 'AWS_S3_REGION_NAME', 'us-west-2')
        prefix = prefix if prefix.endswith('/') else prefix + '/'

        s3_client = boto3.client(
            's3',
            region_name=region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )

        # Validate collection target without writing when --dry-run
        collection_label = self._validate_collection_target(
            user_id=user_id,
            collection_id=collection_id,
            collection_name=collection_name,
        )

        keys = []
        paginator = s3_client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get('Contents', []):
                key = obj.get('Key')
                if not key or key.endswith('/'):
                    continue
                if not matches_media_type(key, media_type):
                    continue
                keys.append(key)

        if not keys:
            self.stdout.write(self.style.WARNING(
                f'No {media_type} files found under {prefix}'
            ))
            return

        imported = 0
        skipped = 0
        collection = None

        for key in keys:
            key = key.strip()
            title = title_from_key(key, title_from)

            if is_unsafe_s3_key(key):
                self.stdout.write(self.style.WARNING(f'  Skip unsafe: {key}'))
                skipped += 1
                continue

            if FileDetails.objects.filter(file=key).exists():
                self.stdout.write(self.style.WARNING(f'  Skip already imported: {key}'))
                skipped += 1
                continue

            try:
                head = s3_client.head_object(Bucket=bucket, Key=key)
                file_size = head.get('ContentLength')
            except Exception as exc:
                self.stdout.write(self.style.WARNING(f'  Skip head_object failed: {key} ({exc})'))
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(f'  [DRY RUN] {key} -> "{title}"')
                imported += 1
                continue

            if collection is None:
                library, _ = Library.objects.get_or_create(
                    user=user,
                    defaults={'name': f"{user.username}'s Library"},
                )
                collection = self._resolve_collection(
                    library, user_id, collection_id, collection_name
                )

            content = Content.objects.create(
                uploaded_by=user,
                media_type=media_type,
                original_title=title,
                original_author=None,
            )
            ContentProfile.objects.create(
                content=content,
                user=user,
                collection=collection,
                title=title,
                author=None,
                personal_note=None,
                is_visible=True,
                is_producer=True,
            )
            file_details = FileDetails.objects.create(
                content=content,
                file_size=file_size,
            )
            # Set S3 key without triggering storage upload (blob already in S3)
            FileDetails.objects.filter(pk=file_details.pk).update(file=key)

            self.stdout.write(self.style.SUCCESS(
                f'  Created: "{title}" (Content #{content.id}) <- {key}'
            ))
            imported += 1

        mode = '[DRY RUN] ' if dry_run else ''
        coll_part = (
            f'collection_id={collection.id}'
            if collection is not None
            else f'collection={collection_label}'
        )
        self.stdout.write(self.style.SUCCESS(
            f'{mode}Done. imported={imported} skipped={skipped} '
            f'user_id={user_id} {coll_part} prefix={prefix}'
        ))

    def _validate_collection_target(self, user_id, collection_id, collection_name):
        """Validate collection args. Read-only; safe for --dry-run."""
        if collection_id is not None:
            collection = Collection.objects.filter(pk=collection_id).select_related('library').first()
            if not collection:
                raise CommandError(f'Collection id={collection_id} not found.')
            if collection.library.user_id != user_id:
                raise CommandError(
                    f'Collection id={collection_id} does not belong to user id={user_id}.'
                )
            return f'id={collection.id} name="{collection.name}"'
        return f'name="{collection_name}" (get_or_create)'

    def _resolve_collection(self, library, user_id, collection_id, collection_name):
        if collection_id is not None:
            collection = Collection.objects.filter(pk=collection_id).select_related('library').first()
            if not collection:
                raise CommandError(f'Collection id={collection_id} not found.')
            if collection.library.user_id != user_id:
                raise CommandError(
                    f'Collection id={collection_id} does not belong to user id={user_id}.'
                )
            return collection

        collection, created = Collection.objects.get_or_create(
            library=library,
            name=collection_name,
        )
        if created:
            self.stdout.write(self.style.SUCCESS(
                f'Created collection "{collection_name}" (id={collection.id})'
            ))
        return collection
