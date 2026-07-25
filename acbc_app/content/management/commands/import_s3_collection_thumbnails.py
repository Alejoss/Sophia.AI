"""
Assign ContentProfile thumbnails from S3 cover images already next to imported PDFs.

Expected pairing (same directory / prefix):
  Biblioteca Acracia/Foo/Bar.pdf
  Biblioteca Acracia/Foo/Bar.cover.jpg

Looks up FileDetails by the PDF key, then sets thumbnail on the user's ContentProfile
(download cover bytes → thumbnail.save → generate thumbnail_preview). Does not re-upload PDFs.

Examples:
  python manage.py import_s3_collection_thumbnails \\
    --user-id 2 --prefix "Biblioteca Acracia/" --dry-run

  python manage.py import_s3_collection_thumbnails \\
    --user-id 2 --prefix "Biblioteca Acracia/" --collection-name "Biblioteca Acracia"
"""
import os
import re

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError

from content.image_utils import (
    delete_content_profile_thumbnail_preview,
    generate_content_profile_thumbnail_preview,
    validate_image_bytes,
)
from content.models import Collection, ContentProfile, FileDetails
from content.s3_key_utils import is_unsafe_s3_key

COVER_SUFFIX_RE = re.compile(
    r'\.cover\.(jpg|jpeg|png|webp|gif)$',
    re.IGNORECASE,
)


def pdf_key_from_cover_key(cover_key: str) -> str | None:
    if not COVER_SUFFIX_RE.search(cover_key):
        return None
    return COVER_SUFFIX_RE.sub('.pdf', cover_key)


class Command(BaseCommand):
    help = (
        'Link S3 *.cover.* images to ContentProfiles for PDFs already imported '
        'under the same prefix (match by sibling key, not title).'
    )

    def add_arguments(self, parser):
        parser.add_argument('--user-id', type=int, required=True)
        parser.add_argument(
            '--prefix',
            type=str,
            required=True,
            help='S3 prefix that contains PDF + *.cover.* pairs (trailing / added if missing).',
        )
        parser.add_argument(
            '--collection-id',
            type=int,
            default=None,
            help='Optional: only assign profiles in this collection (must belong to user).',
        )
        parser.add_argument(
            '--collection-name',
            type=str,
            default=None,
            help='Optional: only assign profiles in this collection name under the user library.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='List matches only; do not write DB or download covers.',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Overwrite profiles that already have a thumbnail.',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Process at most N cover keys (useful for smoke tests).',
        )

    def handle(self, *args, **options):
        user_id = options['user_id']
        prefix = options['prefix']
        collection_id = options['collection_id']
        collection_name = options['collection_name']
        dry_run = options['dry_run']
        force = options['force']
        limit = options['limit']

        user = User.objects.filter(pk=user_id).first()
        if not user:
            raise CommandError(f'User id={user_id} not found.')

        if collection_id and collection_name:
            raise CommandError('Use only one of --collection-id or --collection-name.')

        collection = None
        if collection_id is not None:
            collection = Collection.objects.filter(pk=collection_id).select_related('library').first()
            if not collection:
                raise CommandError(f'Collection id={collection_id} not found.')
            if collection.library.user_id != user_id:
                raise CommandError(
                    f'Collection id={collection_id} does not belong to user id={user_id}.'
                )
        elif collection_name:
            collection = Collection.objects.filter(
                library__user_id=user_id,
                name=collection_name,
            ).first()
            if not collection:
                raise CommandError(
                    f'Collection name="{collection_name}" not found for user id={user_id}.'
                )

        if not getattr(settings, 'AWS_ACCESS_KEY_ID', None) or not getattr(
            settings, 'AWS_SECRET_ACCESS_KEY', None
        ):
            raise CommandError(
                'AWS credentials not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).'
            )

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

        cover_keys = []
        paginator = s3_client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get('Contents', []):
                key = obj.get('Key')
                if not key or key.endswith('/'):
                    continue
                if COVER_SUFFIX_RE.search(key):
                    cover_keys.append(key)

        cover_keys.sort()
        if limit is not None:
            cover_keys = cover_keys[: max(0, limit)]

        if not cover_keys:
            self.stdout.write(self.style.WARNING(f'No *.cover.* files found under {prefix}'))
            return

        self.stdout.write(f'Found {len(cover_keys)} cover object(s) under {prefix}')

        updated = 0
        skipped_existing = 0
        skipped_no_pdf = 0
        skipped_no_profile = 0
        skipped_unsafe = 0
        skipped_wrong_collection = 0
        errors = 0

        for cover_key in cover_keys:
            cover_key = cover_key.strip()
            if is_unsafe_s3_key(cover_key):
                self.stdout.write(self.style.WARNING(f'  Skip unsafe: {cover_key}'))
                skipped_unsafe += 1
                continue

            pdf_key = pdf_key_from_cover_key(cover_key)
            if not pdf_key:
                skipped_no_pdf += 1
                continue

            file_details = (
                FileDetails.objects.filter(file=pdf_key)
                .select_related('content')
                .first()
            )
            if not file_details:
                self.stdout.write(self.style.WARNING(f'  Skip no PDF in DB: {pdf_key}'))
                skipped_no_pdf += 1
                continue

            profile_qs = ContentProfile.objects.filter(
                content_id=file_details.content_id,
                user_id=user_id,
            )
            if collection is not None:
                profile_qs = profile_qs.filter(collection_id=collection.id)

            profile = profile_qs.first()
            if not profile:
                # Profile exists but not in requested collection
                if collection is not None and ContentProfile.objects.filter(
                    content_id=file_details.content_id,
                    user_id=user_id,
                ).exists():
                    skipped_wrong_collection += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f'  Skip wrong collection: content={file_details.content_id} {pdf_key}'
                        )
                    )
                else:
                    skipped_no_profile += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f'  Skip no profile for user={user_id}: {pdf_key}'
                        )
                    )
                continue

            if profile.thumbnail and not force:
                skipped_existing += 1
                continue

            label = (
                f'profile={profile.id} content={profile.content_id} '
                f'"{profile.display_title}" <- {os.path.basename(cover_key)}'
            )

            if dry_run:
                self.stdout.write(self.style.SUCCESS(f'  [DRY RUN] Would update {label}'))
                updated += 1
                continue

            try:
                head_or_obj = s3_client.get_object(Bucket=bucket, Key=cover_key)
                image_data = head_or_obj['Body'].read()
                validate_image_bytes(image_data)
                uploaded = ContentFile(image_data, name=os.path.basename(cover_key))
                if profile.thumbnail:
                    profile.thumbnail.delete(save=False)
                delete_content_profile_thumbnail_preview(profile, save=False)
                profile.thumbnail.save(os.path.basename(cover_key), uploaded, save=True)
                generate_content_profile_thumbnail_preview(profile)
            except Exception as exc:
                errors += 1
                self.stdout.write(self.style.ERROR(f'  FAILED {label}: {exc}'))
                continue

            updated += 1
            self.stdout.write(self.style.SUCCESS(f'  Updated {label}'))

        mode = '[DRY RUN] ' if dry_run else ''
        self.stdout.write(
            self.style.SUCCESS(
                f'{mode}Done. updated={updated} skipped_existing={skipped_existing} '
                f'skipped_no_pdf={skipped_no_pdf} skipped_no_profile={skipped_no_profile} '
                f'skipped_wrong_collection={skipped_wrong_collection} '
                f'skipped_unsafe={skipped_unsafe} errors={errors}'
            )
        )
