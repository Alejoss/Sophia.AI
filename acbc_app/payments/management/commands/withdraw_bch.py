"""Sweep BCH from the platform receive address to an external wallet.

Dry-run by default (builds a signed tx, does not broadcast). Ops only — uses
``BCH_PRIVATE_KEY_WIF`` and never exposes the key over HTTP.

Examples::

    # Inspect balance / planned sweep (no broadcast)
    python manage.py withdraw_bch --to bitcoincash:q... --sweep

    # Broadcast a full sweep
    python manage.py withdraw_bch --to bitcoincash:q... --sweep --broadcast --yes

    # Partial send (change returns to the receive address)
    python manage.py withdraw_bch --to bitcoincash:q... --amount-sats 150000 --broadcast --yes
"""
from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from payments.bch_withdraw import (
    BchWithdrawError,
    build_plan,
    execute_withdraw,
)


class Command(BaseCommand):
    help = (
        'Send BCH from BCH_RECEIVE_ADDRESS* using BCH_PRIVATE_KEY_WIF. '
        'Dry-run unless --broadcast is set.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--to',
            required=True,
            help='Destination CashAddr (wallet you control).',
        )
        group = parser.add_mutually_exclusive_group(required=True)
        group.add_argument(
            '--sweep',
            action='store_true',
            help='Send entire balance minus miner fee to --to.',
        )
        group.add_argument(
            '--amount-sats',
            type=int,
            default=None,
            help='Partial send in satoshis (change stays on the receive address).',
        )
        parser.add_argument(
            '--fee-sat-per-byte',
            type=int,
            default=None,
            help='Optional fee rate override (sat/byte). Default: bitcash estimate.',
        )
        parser.add_argument(
            '--broadcast',
            action='store_true',
            help='Actually broadcast the transaction (otherwise dry-run only).',
        )
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Required together with --broadcast to confirm the spend.',
        )

    def handle(self, *args, **options):
        to_address = (options['to'] or '').strip()
        sweep = bool(options['sweep'])
        amount_sats = options['amount_sats']
        broadcast = bool(options['broadcast'])
        yes = bool(options['yes'])
        fee = options['fee_sat_per_byte']

        if broadcast and not yes:
            raise CommandError(
                'Refusing to broadcast without --yes. '
                'Re-run with --broadcast --yes after checking the dry-run output.'
            )

        if sweep:
            amount_sats = None

        try:
            key, plan = build_plan(
                to_address=to_address,
                amount_sats=amount_sats,
                dry_run=not broadcast,
            )
        except BchWithdrawError as exc:
            raise CommandError(str(exc)) from exc

        amount_label = (
            'SWEEP (all minus fee)'
            if plan.amount_sats is None
            else f'{plan.amount_sats} sats'
        )
        self.stdout.write(f'Network:     {plan.network}')
        self.stdout.write(f'From:        {plan.from_address}')
        self.stdout.write(f'To:          {plan.to_address}')
        self.stdout.write(f'UTXOs:       {plan.utxo_count}')
        self.stdout.write(f'Balance:     {plan.balance_sats} sats')
        self.stdout.write(f'Amount:      {amount_label}')
        self.stdout.write(f'Mode:        {"BROADCAST" if broadcast else "DRY-RUN"}')

        try:
            result = execute_withdraw(key, plan, fee_sat_per_byte=fee)
        except Exception as exc:
            raise CommandError(f'Withdraw failed: {exc}') from exc

        if broadcast:
            self.stdout.write(self.style.SUCCESS(f'Broadcast txid: {result}'))
        else:
            preview = result if len(result) <= 120 else f'{result[:120]}…'
            self.stdout.write(self.style.WARNING('Dry-run OK — transaction not broadcast.'))
            self.stdout.write(f'Signed tx preview: {preview}')
            self.stdout.write('Re-run with --broadcast --yes to send.')
