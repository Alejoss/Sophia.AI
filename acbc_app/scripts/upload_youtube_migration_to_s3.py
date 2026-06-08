#!/usr/bin/env python3
"""
Upload locally downloaded YouTube migration videos to S3.

Reads manifest_user_2_downloaded.json (or --manifest) and uploads each file to
its suggested_s3_key using credentials from acbc_app/.env or the environment.

Examples:
  python scripts/upload_youtube_migration_to_s3.py --dry-run
  python scripts/upload_youtube_migration_to_s3.py
  python scripts/upload_youtube_migration_to_s3.py --skip-errors

By default, objects that already exist in S3 are skipped. Use --force to re-upload.

Progress is saved after each file to *_upload_report.json (merged across runs).
Re-run the same command to resume; S3 is the source of truth for what is already uploaded.

Requires: boto3, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env or env.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

ACBC_APP_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MANIFEST = ACBC_APP_ROOT / 'youtube_migration' / 'manifest_user_2_downloaded.json'
DEFAULT_ENV_FILE = ACBC_APP_ROOT / '.env'
DEFAULT_BUCKET = 'academiablockchain'
DEFAULT_REGION = 'us-west-2'


def load_dotenv(path: Path) -> None:
    """Load KEY=VALUE lines into os.environ (does not override existing vars)."""
    if not path.is_file():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, value = line.partition('=')
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def format_bytes(num: int | float) -> str:
    size = float(num)
    for unit in ('B', 'KiB', 'MiB', 'GiB', 'TiB'):
        if size < 1024 or unit == 'TiB':
            return f'{size:.1f} {unit}'
        size /= 1024
    return f'{size:.1f} TiB'


def report_path_for(manifest_path: Path) -> Path:
    return manifest_path.with_name(
        f'{manifest_path.stem}_upload_report{manifest_path.suffix}'
    )


def load_upload_registry(report_path: Path) -> dict[int, dict]:
    if not report_path.is_file():
        return {}
    with report_path.open(encoding='utf-8') as handle:
        data = json.load(handle)
    registry: dict[int, dict] = {}
    for item in data.get('items') or []:
        content_id = item.get('content_id')
        if content_id is not None:
            registry[int(content_id)] = item
    return registry


def save_upload_registry(
    report_path: Path,
    registry: dict[int, dict],
    *,
    manifest_path: Path,
    bucket: str,
    region: str,
) -> None:
    items = sorted(registry.values(), key=lambda row: row.get('content_id') or 0)
    summary = dict(Counter(row.get('upload_status', 'unknown') for row in items))
    report = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'source_manifest': str(manifest_path),
        'bucket': bucket,
        'region': region,
        'summary': summary,
        'count': len(items),
        'items': items,
    }
    with report_path.open('w', encoding='utf-8') as handle:
        json.dump(report, handle, indent=2, ensure_ascii=False)


def record_upload_result(
    registry: dict[int, dict],
    *,
    content_id: int,
    status: str,
    s3_key: str | None = None,
    file_size: int | None = None,
    local_path: str | None = None,
    youtube_channel: str | None = None,
    error: str | None = None,
) -> None:
    entry: dict = {
        'content_id': content_id,
        'upload_status': status,
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    if s3_key:
        entry['s3_key'] = s3_key
    if file_size is not None:
        entry['file_size'] = file_size
    if local_path:
        entry['local_path'] = local_path
    if youtube_channel:
        entry['youtube_channel'] = youtube_channel
    if error:
        entry['error'] = error[-2000:]
    if status in ('uploaded', 'skipped_existing'):
        entry['uploaded_at'] = entry['updated_at']
    registry[content_id] = entry


def s3_object_exists(client, bucket: str, key: str) -> bool:
    try:
        client.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as exc:
        code = exc.response.get('Error', {}).get('Code', '')
        if code in ('404', 'NoSuchKey', 'NotFound'):
            return False
        raise


def upload_one(
    client,
    *,
    bucket: str,
    local_path: Path,
    s3_key: str,
    dry_run: bool,
) -> None:
    if dry_run:
        print(f'  [DRY RUN] would upload -> s3://{bucket}/{s3_key}')
        return

    extra_args = {
        'ACL': 'public-read',
        'ContentType': 'video/mp4',
    }
    client.upload_file(
        str(local_path),
        bucket,
        s3_key,
        ExtraArgs=extra_args,
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Upload YouTube migration videos from downloaded manifest to S3'
    )
    parser.add_argument(
        '--manifest',
        type=Path,
        default=DEFAULT_MANIFEST,
        help=f'Path to *_downloaded.json manifest (default: {DEFAULT_MANIFEST})',
    )
    parser.add_argument(
        '--env-file',
        type=Path,
        default=DEFAULT_ENV_FILE,
        help=f'Load AWS vars from this file (default: {DEFAULT_ENV_FILE})',
    )
    parser.add_argument(
        '--bucket',
        default=None,
        help=f'S3 bucket (default: AWS_STORAGE_BUCKET_NAME or {DEFAULT_BUCKET})',
    )
    parser.add_argument(
        '--region',
        default=None,
        help=f'AWS region (default: AWS_S3_REGION_NAME or {DEFAULT_REGION})',
    )
    parser.add_argument('--dry-run', action='store_true', help='Validate only; do not upload')
    parser.add_argument(
        '--force',
        action='store_true',
        help='Re-upload even if the object already exists in S3 (default: skip existing)',
    )
    parser.add_argument('--start', type=int, default=0, help='Skip first N manifest items')
    parser.add_argument('--limit', type=int, default=0, help='Upload at most N items (0 = all)')
    parser.add_argument(
        '--skip-errors',
        action='store_true',
        help='Continue after a failed upload (default: stop on first error)',
    )
    parser.add_argument(
        '--exclude-channels',
        default='',
        metavar='NAMES',
        help='Comma-separated channel names to skip (default: upload all in manifest)',
    )
    args = parser.parse_args()

    load_dotenv(args.env_file.resolve())

    access_key = os.environ.get('AWS_ACCESS_KEY_ID')
    secret_key = os.environ.get('AWS_SECRET_ACCESS_KEY')
    if not access_key or not secret_key:
        print(
            'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY required in .env or environment.',
            file=sys.stderr,
        )
        return 1

    bucket = args.bucket or os.environ.get('AWS_STORAGE_BUCKET_NAME', DEFAULT_BUCKET)
    region = args.region or os.environ.get('AWS_S3_REGION_NAME', DEFAULT_REGION)

    manifest_path = args.manifest.resolve()
    if not manifest_path.is_file():
        print(f'Manifest not found: {manifest_path}', file=sys.stderr)
        return 1

    with manifest_path.open(encoding='utf-8') as handle:
        data = json.load(handle)

    excluded_channels = {
        part.strip().casefold()
        for part in (args.exclude_channels or '').split(',')
        if part.strip()
    }

    items = data.get('items') or []
    client = boto3.client(
        's3',
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )

    if not args.dry_run:
        try:
            client.head_bucket(Bucket=bucket)
        except ClientError as exc:
            print(f'Cannot access bucket s3://{bucket}: {exc}', file=sys.stderr)
            return 1

    report_path = report_path_for(manifest_path)
    registry = load_upload_registry(report_path)

    print(f'Bucket: s3://{bucket} ({region})')
    print(f'Manifest: {manifest_path} ({len(items)} items)')
    print(f'Report: {report_path}')
    if registry:
        prior = sum(
            1
            for row in registry.values()
            if row.get('upload_status') in ('uploaded', 'skipped_existing')
        )
        print(f'Local registry: {prior} item(s) already marked uploaded/skipped on S3')
    if excluded_channels:
        print(f'Skipping channels: {", ".join(sorted(excluded_channels))}')
    if args.dry_run:
        print('DRY RUN — no uploads')

    processed = 0
    ok = skipped = failed = 0

    for idx, item in enumerate(items):
        if idx < args.start:
            continue
        if args.limit and processed >= args.limit:
            break

        raw_content_id = item.get('content_id')
        channel = (item.get('youtube_channel') or '').strip()
        local_path_raw = item.get('local_path')
        s3_key = (item.get('suggested_s3_key') or '').strip()

        if excluded_channels and channel.casefold() in excluded_channels:
            print(f'Skip channel ({channel}): Content #{raw_content_id}')
            if raw_content_id is not None:
                record_upload_result(
                    registry,
                    content_id=int(raw_content_id),
                    status='skipped_channel',
                    youtube_channel=channel,
                )
                save_upload_registry(
                    report_path,
                    registry,
                    manifest_path=manifest_path,
                    bucket=bucket,
                    region=region,
                )
            processed += 1
            continue

        if not raw_content_id or not s3_key or not local_path_raw:
            print(f'Skip invalid item at index {idx}: missing content_id, path, or s3_key')
            processed += 1
            continue

        content_id = int(raw_content_id)
        local_path = Path(local_path_raw)
        if not local_path.is_file():
            print(f'Missing local file Content #{content_id}: {local_path}', file=sys.stderr)
            record_upload_result(
                registry,
                content_id=content_id,
                status='failed',
                s3_key=s3_key,
                error=f'Local file not found: {local_path}',
            )
            save_upload_registry(
                report_path,
                registry,
                manifest_path=manifest_path,
                bucket=bucket,
                region=region,
            )
            failed += 1
            processed += 1
            if not args.skip_errors:
                break
            continue

        file_size = local_path.stat().st_size
        print(
            f'[{processed + 1}] Content #{content_id} ({format_bytes(file_size)}) '
            f'-> s3://{bucket}/{s3_key}'
        )

        try:
            if not args.force and s3_object_exists(client, bucket, s3_key):
                print('  Already on S3, skip')
                record_upload_result(
                    registry,
                    content_id=content_id,
                    status='skipped_existing',
                    s3_key=s3_key,
                    file_size=file_size,
                    local_path=str(local_path),
                    youtube_channel=channel,
                )
                skipped += 1
            else:
                upload_one(
                    client,
                    bucket=bucket,
                    local_path=local_path,
                    s3_key=s3_key,
                    dry_run=args.dry_run,
                )
                if not args.dry_run:
                    head = client.head_object(Bucket=bucket, Key=s3_key)
                    remote_size = head.get('ContentLength')
                    if remote_size != file_size:
                        raise RuntimeError(
                            f'Size mismatch after upload: local={file_size} s3={remote_size}'
                        )
                print('  OK')
                record_upload_result(
                    registry,
                    content_id=content_id,
                    status='dry_run' if args.dry_run else 'uploaded',
                    s3_key=s3_key,
                    file_size=file_size,
                    local_path=str(local_path),
                    youtube_channel=channel,
                )
                ok += 1
        except Exception as exc:
            print(f'  FAILED: {exc}', file=sys.stderr)
            record_upload_result(
                registry,
                content_id=content_id,
                status='failed',
                s3_key=s3_key,
                error=str(exc),
            )
            failed += 1
            save_upload_registry(
                report_path,
                registry,
                manifest_path=manifest_path,
                bucket=bucket,
                region=region,
            )
            if not args.skip_errors:
                break
        else:
            save_upload_registry(
                report_path,
                registry,
                manifest_path=manifest_path,
                bucket=bucket,
                region=region,
            )

        processed += 1

    print(
        f'Done. this_run: uploaded={ok} skipped_existing={skipped} failed={failed} '
        f'dry_run={args.dry_run}'
    )
    if registry:
        summary = Counter(row.get('upload_status', 'unknown') for row in registry.values())
        print(f'Registry total: {dict(summary)}')
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    raise SystemExit(main())
