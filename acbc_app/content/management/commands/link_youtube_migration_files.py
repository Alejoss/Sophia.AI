"""
Link manually uploaded S3 objects to existing YouTube URL Content rows.

Manifest JSON (same structure as youtube-migration-manifest + link fields):

  {
    "user_id": 1,
    "items": [
      {
        "content_id": 42,
        "s3_key": "content_owner_attach/42/1/Channel_Title_42.mp4",
        "file_size": 12345678
      }
    ]
  }

Use suggested_s3_key from the export manifest when keys match the upload convention.
"""
import json
from pathlib import Path

import boto3
from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from content.models import Content, FileDetails
from content.s3_key_utils import is_unsafe_s3_key
from content.youtube_migration_utils import (
    content_can_owner_attach_file,
    owner_attach_s3_key_prefix,
)


class Command(BaseCommand):
    help = 'Link S3 video keys from a migration manifest to Content/FileDetails (owner-attach).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--manifest',
            type=str,
            required=True,
            help='Path to manifest JSON (export manifest with s3_key per item).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Validate only; do not update the database.',
        )
        parser.add_argument(
            '--clear-url',
            action='store_true',
            help='Clear Content.url after a successful link (file becomes primary source).',
        )
        parser.add_argument(
            '--use-suggested-keys',
            action='store_true',
            help='Use suggested_s3_key from manifest when s3_key is missing.',
        )
        parser.add_argument(
            '--skip-errors',
            action='store_true',
            help='Continue processing remaining items after an error.',
        )

    def handle(self, *args, **options):
        manifest_path = Path(options['manifest'])
        if not manifest_path.is_file():
            self.stderr.write(self.style.ERROR(f'Manifest not found: {manifest_path}'))
            return

        with manifest_path.open(encoding='utf-8') as handle:
            data = json.load(handle)

        user_id = data.get('user_id')
        if not user_id:
            self.stderr.write(self.style.ERROR('Manifest must include user_id'))
            return

        user = User.objects.filter(pk=user_id).first()
        if not user:
            self.stderr.write(self.style.ERROR(f'User id={user_id} not found'))
            return

        if not getattr(settings, 'AWS_ACCESS_KEY_ID', None):
            self.stderr.write(self.style.ERROR('AWS credentials not configured'))
            return

        try:
            s3_client = boto3.client(
                's3',
                region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'us-west-2'),
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f'boto3 client failed: {exc}'))
            return

        bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'academiablockchain')
        items = data.get('items') or []
        linked = 0
        skipped = 0
        failed = 0

        for item in items:
            content_id = item.get('content_id')
            s3_key = item.get('s3_key') or (
                item.get('suggested_s3_key') if options['use_suggested_keys'] else None
            )
            if not content_id or not s3_key:
                self.stdout.write(self.style.WARNING(f'  Skip item missing content_id or s3_key: {item}'))
                skipped += 1
                continue

            try:
                ok = self._link_one(
                    s3_client=s3_client,
                    bucket=bucket,
                    user=user,
                    content_id=int(content_id),
                    s3_key=str(s3_key).strip(),
                    file_size=item.get('file_size'),
                    dry_run=options['dry_run'],
                    clear_url=options['clear_url'],
                )
                if ok:
                    linked += 1
                else:
                    skipped += 1
            except Exception as exc:
                failed += 1
                self.stderr.write(self.style.ERROR(f'  Content #{content_id}: {exc}'))
                if not options['skip_errors']:
                    return

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. linked={linked} skipped={skipped} failed={failed} dry_run={options["dry_run"]}'
            )
        )

    def _link_one(self, *, s3_client, bucket, user, content_id, s3_key, file_size, dry_run, clear_url):
        if is_unsafe_s3_key(s3_key):
            raise ValueError(f'Unsafe s3_key: {s3_key}')

        expected_prefix = owner_attach_s3_key_prefix(content_id, user.id)
        if not s3_key.startswith(expected_prefix):
            raise ValueError(
                f's3_key must start with {expected_prefix!r}, got {s3_key!r}'
            )

        content = Content.objects.filter(pk=content_id).select_related('file_details').first()
        if not content:
            raise ValueError(f'Content #{content_id} not found')

        can_attach, other_count = content_can_owner_attach_file(content, user)
        if not can_attach:
            self.stdout.write(
                self.style.WARNING(
                    f'  Skip Content #{content_id}: not eligible '
                    f'(other_profiles={other_count}, has_file may be set)'
                )
            )
            return False

        head = s3_client.head_object(Bucket=bucket, Key=s3_key)
        resolved_size = file_size
        if resolved_size is None:
            resolved_size = head.get('ContentLength')

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(f'  [DRY RUN] Would link Content #{content_id} -> {s3_key}')
            )
            return True

        file_details, _created = FileDetails.objects.get_or_create(content=content)
        FileDetails.objects.filter(pk=file_details.pk).update(
            file=s3_key,
            file_size=resolved_size,
        )

        if clear_url:
            Content.objects.filter(pk=content_id).update(url='')

        self.stdout.write(self.style.SUCCESS(f'  Linked Content #{content_id} -> {s3_key}'))
        return True
