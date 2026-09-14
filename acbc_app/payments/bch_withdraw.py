"""Sweep / send BCH from the platform receive address (ops only).

Uses ``BCH_PRIVATE_KEY_WIF`` — never exposed over HTTP. Prefer sweeping to a
wallet you control rather than leaving the WIF on the app server long-term.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from django.conf import settings

from payments.bch_client import get_bch_network, get_bch_receive_address


class BchWithdrawError(Exception):
    """Invalid config or withdraw request."""


def _addresses_match(a: str, b: str) -> bool:
    """Match CashAddr full string or payload after the prefix."""
    na, nb = (a or '').strip().lower(), (b or '').strip().lower()
    if not na or not nb:
        return False
    if na == nb:
        return True

    def payload(value: str) -> str:
        return value.split(':', 1)[1] if ':' in value else value

    return payload(na) == payload(nb)



@dataclass
class BchWithdrawPlan:
    network: str
    from_address: str
    to_address: str
    balance_sats: int
    amount_sats: Optional[int]  # None = sweep all (minus fee)
    utxo_count: int
    dry_run: bool


def _load_wif() -> str:
    wif = (getattr(settings, 'BCH_PRIVATE_KEY_WIF', '') or '').strip()
    if not wif:
        raise BchWithdrawError(
            'BCH_PRIVATE_KEY_WIF is empty. Set the WIF for the receive address '
            'in the server .env (ops only; never commit it).'
        )
    return wif


def load_spend_key():
    """Return a bitcash Key / PrivateKeyTestnet for the active BCH network."""
    try:
        from bitcash import Key, PrivateKeyTestnet
    except ImportError as exc:
        raise BchWithdrawError(
            'bitcash is not installed. Add bitcash to requirements and reinstall.'
        ) from exc

    wif = _load_wif()
    network = get_bch_network()
    try:
        if network == 'mainnet':
            return Key(wif)
        return PrivateKeyTestnet(wif)
    except Exception as exc:
        raise BchWithdrawError(f'Invalid BCH_PRIVATE_KEY_WIF: {exc}') from exc


def assert_key_matches_receive_address(key) -> str:
    """Ensure the WIF derives the configured receive address."""
    configured = get_bch_receive_address()
    if not configured:
        raise BchWithdrawError('BCH receive address is not configured.')
    derived = (getattr(key, 'address', '') or '').strip()
    if not _addresses_match(derived, configured):
        raise BchWithdrawError(
            'BCH_PRIVATE_KEY_WIF does not match the configured receive address.\n'
            f'  derived:    {derived}\n'
            f'  configured: {configured}\n'
            'Refusing to spend — wrong key or wrong BCH_RECEIVE_ADDRESS*.'
        )
    return derived


def build_plan(*, to_address: str, amount_sats: Optional[int], dry_run: bool) -> tuple[Any, BchWithdrawPlan]:
    to_address = (to_address or '').strip()
    if not to_address or ':' not in to_address:
        raise BchWithdrawError(
            'Destination must be a CashAddr (bitcoincash:q… or bchtest:q…).'
        )

    key = load_spend_key()
    from_address = assert_key_matches_receive_address(key)

    if _addresses_match(to_address, from_address):
        raise BchWithdrawError('Destination is the same as the receive address.')

    try:
        unspents = key.get_unspents()
    except Exception as exc:
        raise BchWithdrawError(f'Could not fetch UTXOs: {exc}') from exc

    balance = int(sum(int(u.amount) for u in unspents))
    if balance <= 0:
        raise BchWithdrawError(f'No spendable balance on {from_address}.')

    if amount_sats is not None:
        if amount_sats <= 0:
            raise BchWithdrawError('--amount-sats must be positive.')
        if amount_sats >= balance:
            raise BchWithdrawError(
                f'--amount-sats {amount_sats} leaves no room for the miner fee '
                f'(balance={balance}). Use --sweep to send all minus fee.'
            )

    plan = BchWithdrawPlan(
        network=get_bch_network(),
        from_address=from_address,
        to_address=to_address,
        balance_sats=balance,
        amount_sats=amount_sats,
        utxo_count=len(unspents),
        dry_run=dry_run,
    )
    return key, plan


def execute_withdraw(
    key,
    plan: BchWithdrawPlan,
    *,
    fee_sat_per_byte: Optional[int] = None,
) -> str:
    """Build (and optionally broadcast) the withdraw tx. Returns txid or raw hex."""
    fee_kwargs = {}
    if fee_sat_per_byte is not None:
        fee_kwargs['fee'] = int(fee_sat_per_byte)

    if plan.amount_sats is None:
        # Empty outputs → all value minus fee goes to leftover (destination).
        outputs: list = []
        leftover = plan.to_address
    else:
        outputs = [(plan.to_address, int(plan.amount_sats), 'satoshi')]
        leftover = plan.from_address  # change stays on the merchant address

    if plan.dry_run:
        raw = key.create_transaction(outputs, leftover=leftover, **fee_kwargs)
        return raw if isinstance(raw, str) else str(raw)

    txid = key.send(outputs, leftover=leftover, **fee_kwargs)
    return str(txid)
