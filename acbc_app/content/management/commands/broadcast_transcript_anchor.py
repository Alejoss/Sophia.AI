"""
Broadcast a content transcript text_hash to Bitcoin (OP_RETURN).

Examples:
  # Show platform address to fund via faucet
  python manage.py broadcast_transcript_anchor --show-address

  # Create pending anchor + dry-run (build/sign, do not broadcast)
  python manage.py broadcast_transcript_anchor 123 --create --dry-run

  # Broadcast for content_id 123 (creates pending anchor if missing)
  python manage.py broadcast_transcript_anchor 123 --create

  # Refresh confirmations for an existing broadcast
  python manage.py broadcast_transcript_anchor 123 --refresh
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from content.bitcoin.service import (
    AnchorBroadcastError,
    broadcast_anchor,
    ensure_pending_anchor,
    platform_address,
    refresh_anchor_confirmations,
)
from content.bitcoin.tx_builder import BitcoinWalletError
from content.models import Content, TranscriptAnchor


class Command(BaseCommand):
    help = (
        'Anchor a content transcript text_hash on Bitcoin via OP_RETURN '
        '(mempool.space Esplora API + platform WIF).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            'content_id',
            nargs='?',
            type=int,
            help='Content primary key whose current transcript hash will be anchored',
        )
        parser.add_argument(
            '--create',
            action='store_true',
            help='Create a pending TranscriptAnchor for the current text_hash if missing',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Build and sign the tx but do not broadcast; store metadata only',
        )
        parser.add_argument(
            '--refresh',
            action='store_true',
            help='Only refresh confirmation status for an existing btc_txid',
        )
        parser.add_argument(
            '--show-address',
            action='store_true',
            help='Print the platform P2WPKH address derived from BTC_PRIVATE_KEY_WIF and exit',
        )
        parser.add_argument(
            '--network',
            default=None,
            help='Override BTC network for this run (default: settings.BTC_NETWORK)',
        )

    def handle(self, *args, **options):
        network = (options['network'] or settings.BTC_NETWORK).lower()

        if options['show_address']:
            try:
                address = platform_address(network)
            except BitcoinWalletError as exc:
                raise CommandError(str(exc)) from exc
            self.stdout.write(self.style.SUCCESS(f'network={network}'))
            self.stdout.write(self.style.SUCCESS(f'address={address}'))
            self.stdout.write(
                f'Fund this address on {network}, then re-run with a content_id.'
            )
            self.stdout.write(f'API: {settings.BTC_API_BASE}')
            return

        content_id = options['content_id']
        if content_id is None:
            raise CommandError('content_id is required unless --show-address is set')

        try:
            content = Content.objects.select_related('transcript').get(pk=content_id)
        except Content.DoesNotExist as exc:
            raise CommandError(f'Content {content_id} not found') from exc

        if options['refresh']:
            anchor = TranscriptAnchor.objects.filter(
                content=content,
            ).order_by('-created_at').first()
            if anchor is None or not anchor.btc_txid:
                raise CommandError('No anchor with btc_txid found for this content')
            try:
                anchor = refresh_anchor_confirmations(anchor)
            except AnchorBroadcastError as exc:
                raise CommandError(str(exc)) from exc
            self._print_anchor(anchor)
            return

        try:
            if options['create']:
                anchor = ensure_pending_anchor(content, network=network)
            else:
                transcript = getattr(content, 'transcript', None)
                if transcript is None:
                    raise CommandError('Content has no transcript; cannot anchor')
                anchor = TranscriptAnchor.objects.filter(
                    content=content,
                    text_hash=transcript.text_hash,
                ).first()
                if anchor is None:
                    raise CommandError(
                        'No TranscriptAnchor for current text_hash. '
                        'Re-run with --create or prepare via API first.'
                    )
            if options['network']:
                anchor.btc_network = network
                anchor.save(update_fields=['btc_network', 'updated_at'])

            anchor = broadcast_anchor(anchor, dry_run=options['dry_run'])
        except (AnchorBroadcastError, BitcoinWalletError) as exc:
            raise CommandError(str(exc)) from exc

        self._print_anchor(anchor)
        if options['dry_run']:
            self.stdout.write(self.style.WARNING('Dry run only — nothing broadcast.'))
        elif anchor.btc_txid:
            explorer = (anchor.metadata or {}).get('explorer_url')
            if explorer:
                self.stdout.write(explorer)

    def _print_anchor(self, anchor: TranscriptAnchor):
        self.stdout.write(f'anchor_id={anchor.pk}')
        self.stdout.write(f'content_id={anchor.content_id}')
        self.stdout.write(f'text_hash={anchor.text_hash}')
        self.stdout.write(f'status={anchor.status}')
        self.stdout.write(f'btc_network={anchor.btc_network}')
        self.stdout.write(f'btc_txid={anchor.btc_txid or ""}')
        self.stdout.write(f'btc_op_return_hex={anchor.btc_op_return_hex or ""}')
        self.stdout.write(f'confirmations={anchor.btc_confirmations}')
        if anchor.error_message:
            self.stdout.write(self.style.ERROR(f'error={anchor.error_message}'))
        else:
            self.stdout.write(self.style.SUCCESS('ok'))
