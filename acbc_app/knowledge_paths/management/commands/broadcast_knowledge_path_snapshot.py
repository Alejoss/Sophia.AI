"""
Broadcast a published knowledge-path snapshot digest to Bitcoin (OP_RETURN).

Examples:
  python manage.py broadcast_knowledge_path_snapshot --show-address

  # Dry-run for path 10 latest version
  python manage.py broadcast_knowledge_path_snapshot 10 --create --dry-run

  # Broadcast version 2
  python manage.py broadcast_knowledge_path_snapshot 10 --version 2 --create

  # Refresh confirmations
  python manage.py broadcast_knowledge_path_snapshot 10 --version 2 --refresh
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from content.bitcoin.service import platform_address
from content.bitcoin.tx_builder import BitcoinWalletError
from knowledge_paths.models import (
    KnowledgePath,
    KnowledgePathSnapshotAnchor,
    PublishedKnowledgePathSnapshot,
)
from knowledge_paths.services.snapshot_anchor import (
    SnapshotAnchorError,
    broadcast_snapshot_anchor,
    ensure_pending_snapshot_anchor,
    refresh_snapshot_anchor_confirmations,
)


class Command(BaseCommand):
    help = (
        'Anchor a published knowledge-path snapshot digest on Bitcoin via '
        'OP_RETURN (prefix ACBC2; same wallet/Esplora stack as transcript anchors).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            'knowledge_path_id',
            nargs='?',
            type=int,
            help='KnowledgePath primary key',
        )
        parser.add_argument(
            '--version',
            type=int,
            default=None,
            help='Published snapshot version (default: latest)',
        )
        parser.add_argument(
            '--create',
            action='store_true',
            help='Create a pending KnowledgePathSnapshotAnchor if missing',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Build and sign the tx but do not broadcast',
        )
        parser.add_argument(
            '--refresh',
            action='store_true',
            help='Only refresh confirmation status for an existing btc_txid',
        )
        parser.add_argument(
            '--show-address',
            action='store_true',
            help='Print the platform P2WPKH address and exit',
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
                f'Fund this address on {network}, then re-run with a knowledge_path_id.'
            )
            self.stdout.write(f'API: {settings.BTC_API_BASE}')
            return

        path_id = options['knowledge_path_id']
        if path_id is None:
            raise CommandError('knowledge_path_id is required unless --show-address is set')

        try:
            path = KnowledgePath.objects.get(pk=path_id)
        except KnowledgePath.DoesNotExist as exc:
            raise CommandError(f'KnowledgePath {path_id} not found') from exc

        qs = PublishedKnowledgePathSnapshot.objects.filter(knowledge_path=path)
        if options['version'] is not None:
            snapshot = qs.filter(version=options['version']).first()
            if snapshot is None:
                raise CommandError(
                    f'No published snapshot v{options["version"]} for path {path_id}'
                )
        else:
            snapshot = qs.order_by('-version').first()
            if snapshot is None:
                raise CommandError(f'No published snapshots for path {path_id}')

        if options['refresh']:
            try:
                anchor = snapshot.bitcoin_anchor
            except KnowledgePathSnapshotAnchor.DoesNotExist as exc:
                raise CommandError('No Bitcoin anchor found for this snapshot') from exc
            if not anchor.btc_txid:
                raise CommandError('Anchor has no btc_txid')
            try:
                anchor = refresh_snapshot_anchor_confirmations(anchor)
            except SnapshotAnchorError as exc:
                raise CommandError(str(exc)) from exc
            self._print_anchor(anchor, snapshot)
            return

        try:
            if options['create']:
                anchor = ensure_pending_snapshot_anchor(snapshot, network=network)
            else:
                try:
                    anchor = snapshot.bitcoin_anchor
                except KnowledgePathSnapshotAnchor.DoesNotExist as exc:
                    raise CommandError(
                        'No anchor row; re-run with --create'
                    ) from exc
            anchor = broadcast_snapshot_anchor(anchor, dry_run=options['dry_run'])
        except SnapshotAnchorError as exc:
            raise CommandError(str(exc)) from exc

        self._print_anchor(anchor, snapshot)

    def _print_anchor(self, anchor, snapshot):
        self.stdout.write(self.style.SUCCESS(
            f'path={snapshot.knowledge_path_id} version={snapshot.version} '
            f'digest={snapshot.digest}'
        ))
        self.stdout.write(f'status={anchor.status}')
        self.stdout.write(f'network={anchor.btc_network}')
        self.stdout.write(f'txid={anchor.btc_txid or "-"}')
        self.stdout.write(f'op_return_hex={anchor.btc_op_return_hex or "-"}')
        self.stdout.write(f'confirmations={anchor.btc_confirmations}')
        explorer = (anchor.metadata or {}).get('explorer_url')
        if explorer:
            self.stdout.write(f'explorer={explorer}')
        if anchor.error_message:
            self.stdout.write(self.style.ERROR(f'error={anchor.error_message}'))
