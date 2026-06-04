#!/usr/bin/env python3
"""Download YouTube migration manifest JSON from the open API."""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ACBC_APP_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ACBC_APP_ROOT / 'youtube_migration' / 'manifest_user_{user_id}.json'


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--user-id', type=int, default=2)
    parser.add_argument(
        '--base-url',
        default='https://academiablockchain.com',
        help='API origin without trailing slash',
    )
    parser.add_argument('--output', type=Path, default=None)
    args = parser.parse_args()

    base = args.base_url.rstrip('/')
    url = f'{base}/api/content/youtube-migration-manifest/?user_id={args.user_id}'
    out = args.output or Path(str(DEFAULT_OUT).format(user_id=args.user_id))

    print(f'GET {url}')
    try:
        with urllib.request.urlopen(url, timeout=120) as response:
            body = response.read().decode('utf-8')
            status = response.status
    except urllib.error.HTTPError as exc:
        print(f'HTTP {exc.code}: {exc.reason}', file=sys.stderr)
        err_body = exc.read().decode('utf-8', errors='replace')[:500]
        print(err_body, file=sys.stderr)
        return 1
    except urllib.error.URLError as exc:
        print(f'Request failed: {exc}', file=sys.stderr)
        return 1

    if status != 200:
        print(f'Unexpected status {status}', file=sys.stderr)
        return 1

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        print('Response is not JSON (is the endpoint deployed?)', file=sys.stderr)
        print(body[:300], file=sys.stderr)
        return 1

    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open('w', encoding='utf-8') as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)

    count = data.get('item_count', len(data.get('items') or []))
    print(f'Saved {count} items -> {out}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
