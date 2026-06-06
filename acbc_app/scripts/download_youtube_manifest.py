#!/usr/bin/env python3
"""
Download YouTube videos from a migration manifest (local machine only).

Fetch manifest:
  curl "http://localhost:8000/api/content/youtube-migration-manifest/?user_id=1" -o manifest.json

Download (recommended for YouTube anti-bot):
  python scripts/download_youtube_manifest.py --manifest manifest.json --skip-done
  python scripts/download_youtube_manifest.py --manifest manifest.json --retry-failed

By default, videos from the "Academia Blockchain" channel are skipped (marked
skipped_own_channel). Items that already have a file on the platform (has_file
in manifest) are never downloaded, even with --force. Pass --exclude-channels ""
to download all channels.

Tips (see yt-dlp wiki):
  - Log into YouTube in the browser you pass to --cookies-from-browser.
  - Close that browser before running (avoids cookie DB locks on Windows).
  - Use conservative sleeps when batch-downloading; YouTube rate-limits aggressively.

Requires: yt-dlp, ffmpeg on PATH, Node.js (for YouTube JS challenge with logged-in cookies).
"""
from __future__ import annotations

import argparse
import json
import random
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Repo layout: acbc_app/scripts/ -> acbc_app/
ACBC_APP_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DOWNLOAD_DIR = ACBC_APP_ROOT / 'youtube_downloads'
DEFAULT_MANIFEST_DIR = ACBC_APP_ROOT / 'youtube_migration'

BOT_ERROR_MARKERS = (
    'sign in to confirm',
    'not a bot',
    'confirm you',
    'http error 429',
    'too many requests',
)

COOKIE_ERROR_MARKERS = (
    'could not copy',
    'cookie database',
    'failed to decrypt',
)

DEFAULT_EXCLUDED_CHANNELS = ('Academia Blockchain',)


def ytdlp_cmd(*args: str) -> list[str]:
    """Return yt-dlp argv prefix (binary on PATH or python -m yt_dlp)."""
    if shutil.which('yt-dlp'):
        return ['yt-dlp', *args]
    return [sys.executable, '-m', 'yt_dlp', *args]


def is_bot_error(message: str) -> bool:
    lower = (message or '').lower()
    return any(marker in lower for marker in BOT_ERROR_MARKERS)


def is_cookie_error(message: str) -> bool:
    lower = (message or '').lower()
    return any(marker in lower for marker in COOKIE_ERROR_MARKERS)


def normalize_channel_name(name: str) -> str:
    return (name or '').strip().casefold()


def is_excluded_channel(channel: str, excluded: tuple[str, ...]) -> bool:
    normalized = normalize_channel_name(channel)
    return any(normalize_channel_name(excluded_name) == normalized for excluded_name in excluded)


def parse_excluded_channels(raw: str | None) -> tuple[str, ...]:
    if raw is None:
        return DEFAULT_EXCLUDED_CHANNELS
    value = raw.strip()
    if not value:
        return ()
    return tuple(part.strip() for part in value.split(',') if part.strip())


def item_has_platform_file(item: dict) -> bool:
    """True when the manifest says this content already has an owner file attached."""
    return bool(item.get('has_file'))


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


def build_ytdlp_common_args(args: argparse.Namespace) -> list[str]:
    """Shared yt-dlp flags for auth, throttling, and retries."""
    cmd: list[str] = [
        '--js-runtimes',
        args.js_runtime,
        '--remote-components',
        args.remote_components,
        '--sleep-requests',
        str(args.sleep_requests),
        '--sleep-interval',
        str(args.sleep_interval),
        '--max-sleep-interval',
        str(args.max_sleep_interval),
        '--limit-rate',
        args.limit_rate,
        '--retries',
        str(args.retries),
        '--fragment-retries',
        str(args.retries),
        '--retry-sleep',
        'exp=1:120',
        '--no-warnings',
    ]
    if args.cookies_from_browser:
        cmd.extend(['--cookies-from-browser', args.cookies_from_browser])
    elif args.cookies_file:
        cmd.extend(['--cookies', str(Path(args.cookies_file).resolve())])
    if args.force_ipv4:
        cmd.append('--force-ipv4')
    return cmd


def run_ytdlp(cmd: list[str], timeout: int = 7200) -> tuple[int, str]:
    """Run yt-dlp, stream output, return (exit_code, captured_tail_for_errors)."""
    tail_lines: list[str] = []
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
    )
    assert proc.stdout is not None
    try:
        for line in proc.stdout:
            print(line, end='')
            tail_lines.append(line.rstrip())
            if len(tail_lines) > 40:
                tail_lines.pop(0)
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
        return 1, 'yt-dlp timed out'
    tail = '\n'.join(tail_lines[-15:]).strip()
    return proc.returncode or 0, tail


def fetch_channel_ytdlp(url: str, common_args: list[str]) -> str | None:
    try:
        cmd = ytdlp_cmd(
            *common_args,
            '--print',
            'channel',
            '--no-download',
            url,
        )
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
        if result.returncode == 0:
            lines = (result.stdout or '').strip().splitlines()
            if lines:
                return lines[-1].strip() or None
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None
    return None


def download_one(
    url: str,
    dest_path: Path,
    temp_dir: Path,
    common_args: list[str],
) -> Path:
    """Download with yt-dlp; return final path."""
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_template = str(temp_dir / 'tmp.%(ext)s')
    cmd = ytdlp_cmd(
        *common_args,
        '-f',
        'bestvideo+bestaudio/bestvideo/bestaudio/best',
        '--merge-output-format',
        'mp4',
        '-o',
        temp_template,
        url,
    )
    code, tail = run_ytdlp(cmd)
    if code != 0:
        detail = tail or f'yt-dlp exited with code {code}'
        raise RuntimeError(detail)

    candidates = list(temp_dir.glob('tmp.*'))
    if not candidates:
        raise FileNotFoundError(f'yt-dlp produced no file under {temp_dir}')
    source = candidates[0]
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    if dest_path.exists():
        dest_path.unlink()
    shutil.move(str(source), str(dest_path))
    return dest_path


def write_manifest(manifest_path: Path, data: dict) -> None:
    backup = manifest_path.with_suffix('.json.bak')
    if manifest_path.exists() and not backup.exists():
        shutil.copy2(manifest_path, backup)
    with manifest_path.open('w', encoding='utf-8') as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)


def write_failure_report(manifest_path: Path, data: dict) -> Path | None:
    failures = [
        {
            'content_id': item.get('content_id'),
            'title': item.get('title'),
            'youtube_url': item.get('youtube_url'),
            'youtube_channel': item.get('youtube_channel'),
            'download_status': item.get('download_status'),
            'download_error': item.get('download_error'),
        }
        for item in data.get('items') or []
        if item.get('download_status') == 'failed'
    ]
    if not failures:
        return None

    report_path = manifest_path.with_name(
        f'{manifest_path.stem}_failures{manifest_path.suffix}'
    )
    report = {
        'user_id': data.get('user_id'),
        'username': data.get('username'),
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'failure_count': len(failures),
        'failures': failures,
    }
    with report_path.open('w', encoding='utf-8') as handle:
        json.dump(report, handle, indent=2, ensure_ascii=False)
    return report_path


def write_downloaded_report(
    manifest_path: Path, data: dict, download_dir: Path
) -> Path:
    """Write JSON list of videos that exist on disk (ready for S3 upload)."""
    entries = []
    for item in data.get('items') or []:
        filename = item.get('suggested_local_filename')
        if not filename:
            continue
        dest = download_dir / filename
        if not dest.is_file():
            continue
        entries.append(
            {
                'content_id': item.get('content_id'),
                'title': item.get('title'),
                'youtube_url': item.get('youtube_url'),
                'youtube_channel': item.get('youtube_channel'),
                'suggested_local_filename': filename,
                'suggested_s3_key': item.get('suggested_s3_key'),
                'local_path': str(dest),
                'file_size': dest.stat().st_size,
                'download_status': item.get('download_status') or 'downloaded',
            }
        )

    report_path = manifest_path.with_name(
        f'{manifest_path.stem}_downloaded{manifest_path.suffix}'
    )
    report = {
        'user_id': data.get('user_id'),
        'username': data.get('username'),
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'download_dir': str(download_dir),
        'count': len(entries),
        'items': sorted(entries, key=lambda x: x.get('content_id') or 0),
    }
    with report_path.open('w', encoding='utf-8') as handle:
        json.dump(report, handle, indent=2, ensure_ascii=False)
    return report_path


def summarize_downloads(items: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        status = item.get('download_status') or 'pending'
        counts[status] = counts.get(status, 0) + 1
    return counts


def pause_between_videos(args: argparse.Namespace, reason: str = '') -> None:
    seconds = random.uniform(args.between_videos_min, args.between_videos_max)
    label = f' ({reason})' if reason else ''
    print(f'Pausing {seconds:.0f}s before next video{label}...')
    time.sleep(seconds)


def pause_on_bot_block(args: argparse.Namespace, consecutive: int) -> None:
    base = args.pause_on_bot_base
    maximum = args.pause_on_bot_max
    seconds = min(base * (2 ** max(consecutive - 1, 0)), maximum)
    print(
        f'YouTube bot/rate-limit detected ({consecutive} in a row). '
        f'Cooling down {seconds:.0f}s...',
        file=sys.stderr,
    )
    time.sleep(seconds)


def main() -> int:
    parser = argparse.ArgumentParser(description='Download YouTube videos from migration manifest')
    parser.add_argument('--manifest', type=Path, required=True, help='Path to manifest JSON')
    parser.add_argument(
        '--download-dir',
        type=Path,
        default=DEFAULT_DOWNLOAD_DIR,
        help=f'Directory for video files (default: {DEFAULT_DOWNLOAD_DIR})',
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=0,
        help='Process only N manifest items after --start (0 = all)',
    )
    parser.add_argument(
        '--start',
        type=int,
        default=0,
        help='Skip the first N manifest items',
    )
    parser.add_argument(
        '--skip-done',
        action='store_true',
        help='Skip items already downloaded or marked skipped (resume a batch run)',
    )
    parser.add_argument(
        '--retry-failed',
        action='store_true',
        help='Only attempt items whose download_status is failed',
    )
    parser.add_argument(
        '--exclude-channels',
        default=','.join(DEFAULT_EXCLUDED_CHANNELS),
        metavar='NAMES',
        help=(
            'Comma-separated channel names to skip (default: Academia Blockchain). '
            'Pass empty string to disable: --exclude-channels ""'
        ),
    )
    parser.add_argument('--force', action='store_true', help='Re-download even if local file exists (never overrides has_file or channel exclusions)')
    parser.add_argument(
        '--refresh-channel',
        action='store_true',
        help='Re-fetch channel name via yt-dlp before download (updates filename)',
    )
    parser.add_argument(
        '--cookies-from-browser',
        default='firefox',
        metavar='BROWSER[:PROFILE]',
        help=(
            'Use logged-in YouTube session from browser (default: firefox). '
            'On Windows, Chrome/Edge often fail DPAPI decrypt; Firefox usually works. '
            'Examples: firefox, chrome, edge, "chrome:Default". '
            'Pass empty string to disable: --cookies-from-browser ""'
        ),
    )
    parser.add_argument(
        '--cookies-file',
        type=Path,
        default=None,
        help='Path to Netscape cookies.txt (alternative to --cookies-from-browser)',
    )
    parser.add_argument(
        '--sleep-requests',
        type=float,
        default=3.0,
        help='Seconds to sleep between yt-dlp metadata requests (default: 3)',
    )
    parser.add_argument(
        '--sleep-interval',
        type=float,
        default=30.0,
        help='Min seconds yt-dlp sleeps before each download (default: 30)',
    )
    parser.add_argument(
        '--max-sleep-interval',
        type=float,
        default=90.0,
        help='Max seconds yt-dlp sleeps before each download (default: 90)',
    )
    parser.add_argument(
        '--between-videos-min',
        type=float,
        default=45.0,
        help='Min extra pause in Python after each item (default: 45)',
    )
    parser.add_argument(
        '--between-videos-max',
        type=float,
        default=120.0,
        help='Max extra pause in Python after each item (default: 120)',
    )
    parser.add_argument(
        '--pause-on-bot-base',
        type=float,
        default=300.0,
        help='Base cooldown seconds after bot/rate-limit errors (default: 300)',
    )
    parser.add_argument(
        '--pause-on-bot-max',
        type=float,
        default=3600.0,
        help='Max cooldown seconds after repeated bot errors (default: 3600)',
    )
    parser.add_argument(
        '--stop-after-bot-failures',
        type=int,
        default=5,
        help='Stop batch after N consecutive bot errors (0 = never stop, default: 5)',
    )
    parser.add_argument(
        '--limit-rate',
        default='2M',
        help='Max download speed for yt-dlp, e.g. 2M (default: 2M)',
    )
    parser.add_argument(
        '--retries',
        type=int,
        default=5,
        help='yt-dlp retries per download (default: 5)',
    )
    parser.add_argument(
        '--force-ipv4',
        action='store_true',
        help='Force IPv4 (sometimes helps with YouTube blocks)',
    )
    parser.add_argument(
        '--js-runtime',
        default='node',
        help='JavaScript runtime for YouTube challenge solving (default: node)',
    )
    parser.add_argument(
        '--remote-components',
        default='ejs:github',
        help='yt-dlp remote components for EJS (default: ejs:github)',
    )
    args = parser.parse_args()

    if args.cookies_from_browser == '':
        args.cookies_from_browser = None

    try:
        subprocess.run(
            ytdlp_cmd('--version'),
            capture_output=True,
            check=True,
            timeout=30,
        )
    except (subprocess.CalledProcessError, FileNotFoundError, OSError):
        print('yt-dlp not found. Install: pip install yt-dlp', file=sys.stderr)
        return 1

    manifest_path = args.manifest.resolve()
    if not manifest_path.is_file():
        print(f'Manifest not found: {manifest_path}', file=sys.stderr)
        return 1

    with manifest_path.open(encoding='utf-8') as handle:
        data = json.load(handle)

    common_args = build_ytdlp_common_args(args)
    excluded_channels = parse_excluded_channels(args.exclude_channels)
    if excluded_channels:
        print(f'Skipping channels: {", ".join(excluded_channels)}')
    if args.cookies_from_browser:
        print(f'Using cookies from browser: {args.cookies_from_browser}')
    elif args.cookies_file:
        print(f'Using cookies file: {args.cookies_file}')
    else:
        print(
            'WARNING: No cookies configured. YouTube may block batch downloads. '
            'Use --cookies-from-browser chrome (logged in, browser closed).',
            file=sys.stderr,
        )

    items = data.get('items') or []
    download_dir = args.download_dir.resolve()
    download_dir.mkdir(parents=True, exist_ok=True)

    processed = 0
    consecutive_bot_failures = 0
    total_items = len(items)

    for idx, item in enumerate(items):
        if idx < args.start:
            continue
        if args.limit and processed >= args.limit:
            break

        if args.retry_failed and item.get('download_status') != 'failed':
            continue

        content_id = item.get('content_id')

        if item_has_platform_file(item):
            item['download_status'] = 'skipped_has_file'
            item.pop('download_error', None)
            print(f'Skip platform file already attached: Content #{content_id}')
            write_manifest(manifest_path, data)
            processed += 1
            continue

        if not item.get('can_attach_file', True) and not args.force:
            item['download_status'] = 'skipped_not_eligible'
            write_manifest(manifest_path, data)
            processed += 1
            continue

        url = item.get('youtube_url')
        if not url or not content_id:
            item['download_status'] = 'skipped_invalid'
            write_manifest(manifest_path, data)
            processed += 1
            continue

        channel = item.get('youtube_channel') or 'UnknownChannel'
        if args.refresh_channel:
            fetched = fetch_channel_ytdlp(url, common_args)
            if fetched:
                channel = fetched
                item['youtube_channel'] = channel
                pause_between_videos(args, 'after channel lookup')

        title = item.get('title') or 'video'
        filename = item.get('suggested_local_filename') or build_filename(
            channel, title, content_id
        )
        item['suggested_local_filename'] = filename
        user_id = data.get('user_id', 0)
        item['suggested_s3_key'] = (
            f'content_owner_attach/{content_id}/{user_id}/{filename}'
        )

        dest = download_dir / filename
        item['local_path'] = str(dest)

        if excluded_channels and is_excluded_channel(channel, excluded_channels):
            item['download_status'] = 'skipped_own_channel'
            item.pop('download_error', None)
            print(f'Skip own channel ({channel}): Content #{content_id}')
            write_manifest(manifest_path, data)
            processed += 1
            continue

        if args.skip_done and not args.retry_failed:
            status = item.get('download_status')
            if status == 'skipped_has_file':
                print(f'Skip platform file already attached: Content #{content_id}')
                processed += 1
                continue
            if status in ('downloaded', 'already_exists') and dest.exists():
                print(f'Skip done: {dest.name}')
                processed += 1
                continue
            if status == 'downloaded' and not dest.exists():
                item.pop('download_status', None)
                item.pop('file_size', None)

        if dest.exists() and not args.force:
            item['download_status'] = 'already_exists'
            item['file_size'] = dest.stat().st_size
            item.pop('download_error', None)
            print(f'Exists: {dest.name}')
            write_manifest(manifest_path, data)
            processed += 1
            if idx + 1 < total_items:
                pause_between_videos(args)
            continue

        temp_dir = download_dir / f'.tmp_{content_id}'
        try:
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
            print(f'Downloading Content #{content_id} ({idx + 1}/{total_items}): {filename}')
            download_one(url, dest, temp_dir, common_args)
            item['download_status'] = 'downloaded'
            item['file_size'] = dest.stat().st_size
            item.pop('download_error', None)
            consecutive_bot_failures = 0
            print(f'  -> {dest}')
        except Exception as exc:
            error_text = str(exc)
            item['download_status'] = 'failed'
            item['download_error'] = error_text[-2000:]
            print(f'  FAILED: {error_text}', file=sys.stderr)
            if is_cookie_error(error_text):
                print(
                    '\nCookie extraction failed. Close Chrome/Edge/Firefox completely, '
                    'then retry. Or export youtube.com cookies to a file and use '
                    '--cookies-file acbc_app/youtube_migration/cookies.txt\n',
                    file=sys.stderr,
                )
                write_manifest(manifest_path, data)
                break
            if is_bot_error(error_text):
                consecutive_bot_failures += 1
                pause_on_bot_block(args, consecutive_bot_failures)
                if (
                    args.stop_after_bot_failures
                    and consecutive_bot_failures >= args.stop_after_bot_failures
                ):
                    print(
                        f'Stopping after {consecutive_bot_failures} consecutive bot errors. '
                        'Wait a few hours or switch network, then run with --retry-failed.',
                        file=sys.stderr,
                    )
                    write_manifest(manifest_path, data)
                    break
        finally:
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
            write_manifest(manifest_path, data)

        processed += 1
        if idx + 1 < total_items and item.get('download_status') != 'failed':
            pause_between_videos(args)
        elif idx + 1 < total_items and item.get('download_status') == 'failed':
            pause_between_videos(args, 'after failure')

    data['download_dir'] = str(download_dir)
    data['downloaded_at'] = datetime.now(timezone.utc).isoformat()
    data['download_summary'] = summarize_downloads(items)
    data['download_options'] = {
        'cookies_from_browser': args.cookies_from_browser,
        'cookies_file': str(args.cookies_file) if args.cookies_file else None,
        'js_runtime': args.js_runtime,
        'remote_components': args.remote_components,
        'sleep_requests': args.sleep_requests,
        'sleep_interval': args.sleep_interval,
        'max_sleep_interval': args.max_sleep_interval,
        'between_videos_min': args.between_videos_min,
        'between_videos_max': args.between_videos_max,
        'exclude_channels': list(excluded_channels),
    }

    write_manifest(manifest_path, data)
    report_path = write_failure_report(manifest_path, data)
    downloaded_path = write_downloaded_report(manifest_path, data, download_dir)

    print(f'Updated manifest: {manifest_path}')
    print(f'Summary: {data["download_summary"]}')
    print(f'Downloaded list: {downloaded_path} ({downloaded_path.stat().st_size} bytes)')
    if report_path:
        print(f'Failures report: {report_path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
