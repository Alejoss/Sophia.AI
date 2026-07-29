"""Build and sign a 1-in / 2-out tx: OP_RETURN(payload) + change to self (P2WPKH)."""
from __future__ import annotations

from dataclasses import dataclass

from embit import ec, script
from embit.finalizer import finalize_psbt
from embit.networks import NETWORKS
from embit.psbt import PSBT
from embit.script import Script
from embit.transaction import Transaction, TransactionInput, TransactionOutput

# Approximate vbytes for 1 P2WPKH input + OP_RETURN(~40B) + P2WPKH change.
ESTIMATED_VBYTES = 160
# Don't create change below this (fold into fee instead).
DUST_LIMIT_SATS = 546


class BitcoinWalletError(Exception):
    """Invalid key, insufficient funds, or signing failure."""


@dataclass
class BuiltTransaction:
    raw_tx_hex: str
    txid: str
    fee_sats: int
    change_sats: int
    input_sats: int
    from_address: str


def network_params(network_name: str):
    key = {
        'mainnet': 'main',
        'main': 'main',
        'testnet': 'test',
        'test': 'test',
        'testnet4': 'test',
        'signet': 'signet',
        'regtest': 'regtest',
    }.get((network_name or '').lower())
    if not key or key not in NETWORKS:
        raise BitcoinWalletError(f'Unsupported BTC network: {network_name}')
    return NETWORKS[key]


def private_key_from_wif(wif: str, network_name: str) -> ec.PrivateKey:
    if not wif:
        raise BitcoinWalletError('BTC_PRIVATE_KEY_WIF is empty')
    try:
        return ec.PrivateKey.from_wif(wif)
    except Exception as exc:  # noqa: BLE001 — embit raises assorted errors
        raise BitcoinWalletError(f'Invalid WIF: {exc}') from exc


def p2wpkh_address(private_key: ec.PrivateKey, network_name: str) -> str:
    net = network_params(network_name)
    return script.p2wpkh(private_key.get_public_key()).address(network=net)


def build_op_return_script(payload: bytes) -> Script:
    if not payload:
        raise BitcoinWalletError('OP_RETURN payload is empty')
    if len(payload) > 80:
        raise BitcoinWalletError('OP_RETURN payload exceeds 80 bytes')
    return Script(b'\x6a' + bytes([len(payload)]) + payload)


def select_utxos(utxos: list[dict], target_sats: int) -> list[dict]:
    """Greedy largest-first selection until target is met (allows unconfirmed)."""
    spendable = [u for u in utxos if int(u.get('value') or 0) > 0]
    spendable.sort(key=lambda u: int(u['value']), reverse=True)
    selected = []
    total = 0
    for utxo in spendable:
        selected.append(utxo)
        total += int(utxo['value'])
        if total >= target_sats:
            return selected
    raise BitcoinWalletError(
        f'Insufficient funds: have {total} sats, need ~{target_sats} sats'
    )


def build_and_sign_op_return_tx(
    *,
    wif: str,
    network_name: str,
    op_return_payload: bytes,
    utxos: list[dict],
    fee_sat_vb: int,
) -> BuiltTransaction:
    """
    Create a transaction embedding ``op_return_payload`` and returning change
    to the same P2WPKH address derived from ``wif``.
    """
    private_key = private_key_from_wif(wif, network_name)
    net = network_params(network_name)
    spk = script.p2wpkh(private_key.get_public_key())
    address = spk.address(network=net)

    fee_sats = max(1, int(fee_sat_vb) * ESTIMATED_VBYTES)
    # Need enough for fee; OP_RETURN carries 0 value.
    selected = select_utxos(utxos, fee_sats + DUST_LIMIT_SATS)
    input_sats = sum(int(u['value']) for u in selected)

    vins = [
        TransactionInput(bytes.fromhex(u['txid']), int(u['vout']))
        for u in selected
    ]
    op_return_out = TransactionOutput(0, build_op_return_script(op_return_payload))
    change_sats = input_sats - fee_sats
    vouts = [op_return_out]
    if change_sats >= DUST_LIMIT_SATS:
        vouts.append(TransactionOutput(change_sats, spk))
    else:
        # Absorb dust into fee.
        fee_sats = input_sats
        change_sats = 0

    tx = Transaction(vin=vins, vout=vouts)
    psbt = PSBT(tx)
    for idx, utxo in enumerate(selected):
        psbt.inputs[idx].witness_utxo = TransactionOutput(int(utxo['value']), spk)

    signed = psbt.sign_with(private_key)
    if signed < 1:
        raise BitcoinWalletError('Failed to sign transaction (0 inputs signed)')
    final = finalize_psbt(psbt)
    if final is None:
        raise BitcoinWalletError('Failed to finalize PSBT')

    raw = final.serialize().hex()
    # Prefer API-returned txid after broadcast; this is a local estimate.
    txid = bytes(reversed(final.txid())).hex()
    return BuiltTransaction(
        raw_tx_hex=raw,
        txid=txid,
        fee_sats=fee_sats,
        change_sats=change_sats,
        input_sats=input_sats,
        from_address=address,
    )
