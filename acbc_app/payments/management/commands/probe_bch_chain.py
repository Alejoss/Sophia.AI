"""Probe the live BCH indexer without creating a new payment.

Use this to confirm Electrum/Blockchair connectivity and to inspect a known
txid (e.g. a buyer payment) against the configured receive address.
"""
from __future__ import annotations

from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError

from payments.bch_client import (
    BchApiError,
    build_bch_client,
    get_bch_network,
    get_bch_receive_address,
)
from payments.bch_services import (
    _addresses_match,
    _amount_tolerance_usd,
    _tolerance_sats_for_rate,
)


class Command(BaseCommand):
    help = (
        'Query the BCH chain for a txid and/or recent address history. '
        'Does not create or fulfill orders — safe for production debugging.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--txid',
            default='',
            help='Look up a specific transaction (64 hex chars).',
        )
        parser.add_argument(
            '--address',
            default='',
            help='Address to scan (defaults to BCH_RECEIVE_ADDRESS*).',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=10,
            help='How many recent address txs to list (default 10).',
        )
        parser.add_argument(
            '--expected-sats',
            type=int,
            default=None,
            help='If set, report whether each receive output is within USD tolerance.',
        )
        parser.add_argument(
            '--usd-bch-rate',
            default='',
            help='USD/BCH rate for tolerance (default: live rate or BCH_USD_PRICE).',
        )

    def handle(self, *args, **options):
        txid = (options['txid'] or '').strip().lower()
        address = (options['address'] or '').strip() or get_bch_receive_address()
        limit = max(1, int(options['limit'] or 10))
        expected = options['expected_sats']
        rate_raw = (options['usd_bch_rate'] or '').strip()

        if not address and not txid:
            raise CommandError('Need --txid and/or a configured receive address.')

        client = build_bch_client()
        self.stdout.write(f'Network: {get_bch_network()}')
        self.stdout.write(f'Client:  {type(client).__name__}')
        if hasattr(client, 'servers'):
            hosts = ', '.join(f'{c.host}:{c.port}' for c in client.servers)
            self.stdout.write(f'Servers: {hosts}')
            if getattr(client, 'http_fallback', None) is not None:
                self.stdout.write('HTTP fallback: Blockchair enabled')
        self.stdout.write(f'Address: {address or "(none)"}')

        rate = None
        if rate_raw:
            rate = Decimal(rate_raw)
        else:
            try:
                rate = client.get_bch_usd_rate()
                self.stdout.write(self.style.SUCCESS(f'USD/BCH rate: {rate}'))
            except BchApiError as exc:
                self.stdout.write(self.style.WARNING(f'USD/BCH rate unavailable: {exc}'))

        tol_sats = _tolerance_sats_for_rate(rate) if rate is not None else 0
        if expected is not None:
            self.stdout.write(
                f'Tolerance: ±{tol_sats} sats '
                f'(${_amount_tolerance_usd()} at rate {rate})'
            )
            self.stdout.write(f'Expected:  {expected} sats')

        found_receive = False

        if txid:
            if len(txid) != 64 or any(c not in '0123456789abcdef' for c in txid):
                raise CommandError('--txid must be 64 hex characters.')
            self.stdout.write('')
            self.stdout.write(f'=== Transaction {txid} ===')
            try:
                tx = client.get_transaction(txid)
            except BchApiError as exc:
                raise CommandError(f'get_transaction failed: {exc}') from exc
            self.stdout.write(
                f'confirmations={tx.confirmations} timestamp={tx.timestamp} '
                f'outputs={len(tx.outputs)}'
            )
            for out in tx.outputs:
                mark = ''
                if address and _addresses_match(out.address, address):
                    found_receive = True
                    mark = ' ← RECEIVE'
                    if expected is not None:
                        delta = abs(int(out.amount_sats) - int(expected))
                        ok = delta <= tol_sats
                        mark += f' delta={delta} sats {"OK" if ok else "OUTSIDE TOL"}'
                self.stdout.write(f'  {out.amount_sats:>12} sats  {out.address}{mark}')

        if address:
            self.stdout.write('')
            self.stdout.write(f'=== Recent history for {address} (limit={limit}) ===')
            try:
                txs = client.list_recent_transactions(address, limit=limit)
            except BchApiError as exc:
                raise CommandError(f'list_recent_transactions failed: {exc}') from exc
            if not txs:
                self.stdout.write(self.style.WARNING('No transactions returned.'))
            for tx in txs:
                receive_outs = [
                    o for o in tx.outputs if _addresses_match(o.address, address)
                ]
                if receive_outs:
                    found_receive = True
                amounts = ', '.join(str(o.amount_sats) for o in receive_outs) or '-'
                flag = ''
                if txid and tx.txid.lower() == txid:
                    flag = ' ★ TARGET TXID'
                self.stdout.write(
                    f'{tx.txid}  conf={tx.confirmations}  ts={tx.timestamp}  '
                    f'receive_sats=[{amounts}]{flag}'
                )

        self.stdout.write('')
        if txid and address and not found_receive:
            raise CommandError(
                'TX looked up OK but no output matched the receive address. '
                'Check BCH_RECEIVE_ADDRESS / network.'
            )
        if txid:
            self.stdout.write(self.style.SUCCESS('Chain lookup succeeded for --txid.'))
        else:
            self.stdout.write(self.style.SUCCESS('Address history lookup succeeded.'))
