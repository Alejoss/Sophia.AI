"""
Restore certified plain text for Bitcoin anchors that only stored the digest.

Examples:
  # Report every anchor whose snapshot is missing
  python manage.py restore_anchor_certified_text --dry-run

  # Store the live transcript wherever its SHA-256 equals the Bitcoin digest
  python manage.py restore_anchor_certified_text

  # One content
  python manage.py restore_anchor_certified_text --content-id 46

  # Exact text from Vincent when the stored transcript no longer matches
  python manage.py restore_anchor_certified_text --anchor-id 2 --plain-text-file original.txt
"""
from django.core.management.base import BaseCommand, CommandError

from content.transcript_utils import restore_missing_anchor_certified_texts


class Command(BaseCommand):
    help = (
        'Restore TranscriptAnchor.certified_plain_text when the transcript or '
        'a supplied file hashes to the digest stored in the Bitcoin anchor.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--content-id',
            type=int,
            default=None,
            help='Limit the scan to one content id',
        )
        parser.add_argument(
            '--anchor-id',
            type=int,
            default=None,
            help='Limit the scan to one TranscriptAnchor id',
        )
        parser.add_argument(
            '--plain-text-file',
            default=None,
            help=(
                'UTF-8 file with the exact text that was hashed. '
                'Requires --content-id or --anchor-id. Saved only on a hash match.'
            ),
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Report what would be restored without writing',
        )

    def handle(self, *args, **options):
        plain_text = None
        path = options['plain_text_file']
        if path:
            if options['content_id'] is None and options['anchor_id'] is None:
                raise CommandError(
                    '--plain-text-file requires --content-id or --anchor-id.'
                )
            try:
                with open(path, encoding='utf-8') as handle:
                    plain_text = handle.read()
            except OSError as exc:
                raise CommandError(f'Could not read {path}: {exc}') from exc

        report = restore_missing_anchor_certified_texts(
            content_id=options['content_id'],
            anchor_id=options['anchor_id'],
            plain_text=plain_text,
            dry_run=options['dry_run'],
        )
        if (options['content_id'] is not None or options['anchor_id'] is not None) and (
            report['checked'] == 0
        ):
            raise CommandError('No anchors matched that content_id / anchor_id.')

        for row in report['anchors']:
            digest = (row.get('text_hash') or '')[:12]
            computed = row.get('computed_text_hash') or '-'
            self.stdout.write(
                f"{row['status']} anchor={row['anchor_id']} content={row['content_id']} "
                f"text_hash={digest}... computed={computed} "
                f"txid={row.get('btc_txid') or '-'}"
            )
        summary = (
            f"checked={report['checked']} restored={report['restored']} "
            f"would_restore={report['would_restore']} "
            f"already_present={report['already_present']} "
            f"unmatched={report['unmatched']} dry_run={report['dry_run']}"
        )
        if report['unmatched']:
            self.stdout.write(self.style.WARNING(summary))
        else:
            self.stdout.write(self.style.SUCCESS(summary))
