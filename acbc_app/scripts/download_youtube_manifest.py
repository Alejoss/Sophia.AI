#!/usr/bin/env python3
"""
Download YouTube videos from a migration manifest (local machine only).

Fetch manifest:
  curl "http://localhost:8000/api/content/youtube-migration-manifest/?user_id=1" -o manifest.json

Download:
  python scripts/download_youtube_manifest.py --manifest manifest.json

Requires: yt-dlp, ffmpeg on PATH.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# Repo layout: acbc_app/scripts/ -> acbc_app/
ACBC_APP_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DOWNLOAD_DIR = ACBC_APP_ROOT / 'youtube_downloads'
DEFAULT_MANIFEST_DIR = ACBC_APP_ROOT / 'youtube_migration'


def sanitize_label(text: str, max_length: int) -> str:
    if not text:
        return 'unknown'
    value = str(text).strip()
    value = re.sub(r'[^\w\s-]', '', value, flags=re.UNICODE)
    value = re.sub(r'[\s_]+', '_', value).strip('_')
    if not value:
        value = 'unknown'
    if len(value) > max_length:
        value = value[:max_length].rstrip('_')
    return value or 'unknown'


def build_filename(channel: str, title: str, content_id: int, ext: str = 'mp4') -> str:
    channel_part = sanitize_label(channel, 40)
    title_part = sanitize_label(title, 60)
    ext = (ext or 'mp4').lstrip('.').lower()
    name = f'{channel_part}_{title_part}_{content_id}.{ext}'
    return name.replace(' ', '_').replace('/', '_').replace('\\', '_')


def fetch_channel_ytdlp(url: str) -> str | None:
    try:
        result = subprocess.run(
            [
                'yt-dlp',
                '--print',
                'channel',
                '--no-download',
                '--no-warnings',
                url,
            ],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        if result.returncode == 0:
            line = (result.stdout or '').strip().splitlines()
            if line:
                return line[-1].strip() or None
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None
    return None


def download_one(url: str, dest_path: Path, temp_dir: Path) -> Path:
    """Download with yt-dlp; return final path."""
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_template = str(temp_dir / 'tmp.%(ext)s')
    cmd = [
        'yt-dlp',
        '-f',
        'bestvideo+bestaudio/best',
        '--merge-output-format',
        'mp4',
        '-o',
        temp_template,
        url,
    ]
    subprocess.run(cmd, check=True, timeout=3600)

    candidates = list(temp_dir.glob('tmp.*'))
    if not candidates:
        raise FileNotFoundError(f'yt-dlp produced no file under {temp_dir}')
    source = candidates[0]
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    if dest_path.exists():
        dest_path.unlink()
    shutil.move(str(source), str(dest_path))
    return dest_path


def main() -> int:
    parser = argparse.ArgumentParser(description='Download YouTube videos from migration manifest')
    parser.add_argument('--manifest', type=Path, required=True, help='Path to manifest JSON')
    parser.add_argument(
        '--download-dir',
        type=Path,
        default=DEFAULT_DOWNLOAD_DIR,
        help=f'Directory for video files (default: {DEFAULT_DOWNLOAD_DIR})',
    )
    parser.add_argument('--limit', type=int, default=0, help='Max items to download (0 = all)')
    parser.add_argument('--force', action='store_true', help='Re-download even if file exists')
    parser.add_argument(
        '--refresh-channel',
        action='store_true',
        help='Re-fetch channel name via yt-dlp before download (updates filename)',
    )
    args = parser.parse_args()

    if not shutil.which('yt-dlp'):
        print('yt-dlp not found on PATH. Install: pip install yt-dlp', file=sys.stderr)
        return 1

    manifest_path = args.manifest.resolve()
    if not manifest_path.is_file():
        print(f'Manifest not found: {manifest_path}', file=sys.stderr)
        return 1

    with manifest_path.open(encoding='utf-8') as handle:
        data = json.load(handle)

    items = data.get('items') or []
    download_dir = args.download_dir.resolve()
    download_dir.mkdir(parents=True, exist_ok=True)

    processed = 0
    for item in items:
        if args.limit and processed >= args.limit:
            break

        if not item.get('can_attach_file', True) and not args.force:
            item['download_status'] = 'skipped_not_eligible'
            continue

        if item.get('has_file'):
            item['download_status'] = 'skipped_has_file'
            continue

        url = item.get('youtube_url')
        content_id = item.get('content_id')
        if not url or not content_id:
            item['download_status'] = 'skipped_invalid'
            continue

        channel = item.get('youtube_channel') or 'UnknownChannel'
        if args.refresh_channel:
            fetched = fetch_channel_ytdlp(url)
            if fetched:
                channel = fetched
                item['youtube_channel'] = channel

        title = item.get('title') or 'video'
        filename = item.get('suggested_local_filename') or build_filename(
            channel, title, content_id
        )
        # Keep manifest in sync if channel/title changed
        item['suggested_local_filename'] = filename
        user_id = data.get('user_id', 0)
        item['suggested_s3_key'] = (
            f'content_owner_attach/{content_id}/{user_id}/{filename}'
        )

        dest = download_dir / filename
        item['local_path'] = str(dest)

        if dest.exists() and not args.force:
            item['download_status'] = 'already_exists'
            item['file_size'] = dest.stat().st_size
            processed += 1
            print(f'Exists: {dest.name}')
            continue

        temp_dir = download_dir / f'.tmp_{content_id}'
        try:
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
            print(f'Downloading Content #{content_id}: {filename}')
            download_one(url, dest, temp_dir)
            item['download_status'] = 'downloaded'
            item['file_size'] = dest.stat().st_size
            processed += 1
            print(f'  -> {dest}')
        except subprocess.CalledProcessError as exc:
            item['download_status'] = 'failed'
            item['download_error'] = str(exc)
            print(f'  FAILED: {exc}', file=sys.stderr)
        except Exception as exc:
            item['download_status'] = 'failed'
            item['download_error'] = str(exc)
            print(f'  FAILED: {exc}', file=sys.stderr)
        finally:
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)

    data['download_dir'] = str(download_dir)
    data['downloaded_at'] = datetime.now(timezone.utc).isoformat()

    out_path = manifest_path
    backup = manifest_path.with_suffix('.json.bak')
    if manifest_path.exists():
        shutil.copy2(manifest_path, backup)
    with out_path.open('w', encoding='utf-8') as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)

    print(f'Updated manifest: {out_path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
