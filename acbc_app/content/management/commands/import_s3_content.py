"""
One-off command: import all VIDEO files from S3 folder "Ucronia Subtitlos Español/"
into the library of user id=2. Creates Content/ContentProfile/FileDetails exactly
as UploadContentConfirmView does (form flow).
"""
import os
from django.core.management.base import BaseCommand
from django.conf import settings
from django.contrib.auth.models import User

from content.models import Library, Collection, Content, ContentProfile, FileDetails

# Hardcoded for one-time use
USER_ID = 2
S3_PREFIX = "Ucronia Subtitlos Español/"
COLLECTION_NAME = "Ucronia Subtitlos Español"
VIDEO_EXTENSIONS = {'mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'}
# PositiveIntegerField max (PostgreSQL); larger files store None
MAX_FILE_SIZE = 2147483647


def is_video_key(key):
    ext = key.split('.')[-1].lower() if '.' in key else ''
    return ext in VIDEO_EXTENSIONS


def title_from_key(key):
    """
    Derive display title from S3 key. E.g. "01 - Datos_ES.mp4" -> "Ucronía 01 - Datos (subtítulos español)"
    """
    filename = key.split('/')[-1]
    name_no_ext = os.path.splitext(filename)[0]  # "01 - Datos_ES" or "01 - Datos"
    if name_no_ext.endswith('_ES'):
        base = name_no_ext[:-3].strip()  # "01 - Datos"
        suffix = " (subtítulos español)"
    else:
        base = name_no_ext
        suffix = ""
    return f"Ucronía {base}{suffix}"


class Command(BaseCommand):
    help = 'Import videos from S3 folder "Ucronia Subtitlos Español/" into library of user id=2 (one-off).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Only list keys that would be imported, do not create anything.',
        )
        parser.add_argument(
            '--fix-existing',
            action='store_true',
            help='Fix titles of already-imported content with wrong "ES.mp4" names (run before re-import).',
        )

    def handle(self, *args, **options):
        user = User.objects.filter(pk=USER_ID).first()
        if not user:
            self.stderr.write(self.style.ERROR(f'User id={USER_ID} not found.'))
            return

        if options.get('fix_existing'):
            self._fix_existing_titles(user)
            return

        if not getattr(settings, 'AWS_ACCESS_KEY_ID', None) or not getattr(settings, 'AWS_SECRET_ACCESS_KEY', None):
            self.stderr.write(self.style.ERROR('AWS credentials not configured.'))
            return

        try:
            import boto3
        except ImportError:
            self.stderr.write(self.style.ERROR('boto3 required: pip install boto3'))
            return

        bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'academiablockchain')
        region = getattr(settings, 'AWS_S3_REGION_NAME', 'us-west-2')
        prefix = S3_PREFIX if S3_PREFIX.endswith('/') else S3_PREFIX + '/'

        s3_client = boto3.client(
            's3',
            region_name=region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )

        # List only video keys under prefix
        keys = []
        paginator = s3_client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get('Contents', []):
                k = obj.get('Key')
                if k and not k.endswith('/') and is_video_key(k):
                    keys.append(k)

        if not keys:
            self.stdout.write(self.style.WARNING(f'No video files found under {prefix}'))
            return

        # Verify each key exists and get size (same as view: head_object)
        validated = []
        for key in keys:
            key = key.strip()
            if '..' in key or key.startswith('/'):
                continue
            try:
                head = s3_client.head_object(Bucket=bucket, Key=key)
                validated.append((key, head.get('ContentLength')))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Skip {key}: {e}'))

        if not validated:
            self.stderr.write(self.style.ERROR('No valid S3 keys.'))
            return

        if options['dry_run']:
            self.stdout.write(self.style.SUCCESS(f'[DRY RUN] Would import {len(validated)} videos:'))
            for key, size in validated:
                self.stdout.write(f'  {key} -> "{title_from_key(key)}"')
            return

        # Library (one per user, same as view) and collection
        library, _ = Library.objects.get_or_create(
            user=user,
            defaults={'name': f"{user.username}'s Library"},
        )

        collection, _ = Collection.objects.get_or_create(
            library=library,
            defaults={'name': COLLECTION_NAME},
        )
        if collection.name != COLLECTION_NAME:
            collection.name = COLLECTION_NAME
            collection.save()

        # Create content exactly as UploadContentConfirmView (S3 confirm)
        for key, file_size in validated:
            if FileDetails.objects.filter(file=key).exists():
                self.stdout.write(self.style.WARNING(f'  Skip (already imported): {key}'))
                continue
            if file_size is not None and file_size > MAX_FILE_SIZE:
                file_size = None  # PositiveIntegerField overflow for files > ~2GB
            title = title_from_key(key)
            # Same defaults as view: is_visible=True, is_producer=False, author=None, personal_note=None
            content = Content.objects.create(
                uploaded_by=user,
                media_type='VIDEO',
                original_title=title,
                original_author=None,
            )
            content_profile = ContentProfile.objects.create(
                content=content,
                title=title,
                author=None,
                personal_note=None,
                user=user,
                is_visible=True,
                is_producer=True,  # importer is the producer
                collection=collection,
            )
            file_details = FileDetails.objects.create(
                content=content,
                file_size=file_size,
            )
            FileDetails.objects.filter(pk=file_details.pk).update(file=key)
            self.stdout.write(self.style.SUCCESS(f'  Created: "{title}" (Content #{content.id})'))

        self.stdout.write(self.style.SUCCESS(f'Done. Imported {len(validated)} videos into library "{library.name}" for user id={USER_ID}.'))

    def _fix_existing_titles(self, user):
        """Fix Content/ContentProfile titles that were wrongly set to ES.mp4."""
        library = Library.objects.filter(user=user).first()
        if not library:
            self.stdout.write(self.style.WARNING('No library found for user.'))
            return
        collection = Collection.objects.filter(library=library, name=COLLECTION_NAME).first()
        if not collection:
            self.stdout.write(self.style.WARNING(f'Collection "{COLLECTION_NAME}" not found.'))
            return
        profiles = ContentProfile.objects.filter(
            collection=collection,
            title='ES.mp4',
        ).select_related('content')
        count = 0
        for profile in profiles:
            try:
                fd = profile.content.file_details
            except FileDetails.DoesNotExist:
                continue
            key = fd.file.name if fd.file else None
            if not key:
                continue
            new_title = title_from_key(key)
            profile.content.original_title = new_title
            profile.content.save(update_fields=['original_title'])
            profile.title = new_title
            profile.is_producer = True  # importer is the producer
            profile.save(update_fields=['title', 'is_producer'])
            count += 1
            self.stdout.write(self.style.SUCCESS(f'  Fixed: "{key}" -> "{new_title}"'))
        self.stdout.write(self.style.SUCCESS(f'Done. Fixed {count} titles.'))
