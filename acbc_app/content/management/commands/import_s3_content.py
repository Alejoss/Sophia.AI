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


def is_video_key(key):
    ext = key.split('.')[-1].lower() if '.' in key else ''
    return ext in VIDEO_EXTENSIONS


def title_from_key(key):
    """Same as UploadContentConfirmView: key.split('/')[-1].split('_', 1)[-1]"""
    filename = key.split('/')[-1]
    return filename.split('_', 1)[-1] if '_' in filename else filename


class Command(BaseCommand):
    help = 'Import videos from S3 folder "Ucronia Subtitlos Español/" into library of user id=2 (one-off).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Only list keys that would be imported, do not create anything.',
        )

    def handle(self, *args, **options):
        if not getattr(settings, 'AWS_ACCESS_KEY_ID', None) or not getattr(settings, 'AWS_SECRET_ACCESS_KEY', None):
            self.stderr.write(self.style.ERROR('AWS credentials not configured.'))
            return

        try:
            import boto3
        except ImportError:
            self.stderr.write(self.style.ERROR('boto3 required: pip install boto3'))
            return

        user = User.objects.filter(pk=USER_ID).first()
        if not user:
            self.stderr.write(self.style.ERROR(f'User id={USER_ID} not found.'))
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
                is_producer=False,
                collection=collection,
            )
            file_details = FileDetails.objects.create(
                content=content,
                file_size=file_size,
            )
            FileDetails.objects.filter(pk=file_details.pk).update(file=key)
            self.stdout.write(self.style.SUCCESS(f'  Created: "{title}" (Content #{content.id})'))

        self.stdout.write(self.style.SUCCESS(f'Done. Imported {len(validated)} videos into library "{library.name}" for user id={USER_ID}.'))
