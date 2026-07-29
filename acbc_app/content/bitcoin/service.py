"""Orchestrate OP_RETURN broadcast for TranscriptAnchor rows."""
from __future__ import annotations

import logging
from typing import Optional

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from content.bitcoin.esplora import BitcoinApiError, EsploraClient
from content.bitcoin.tx_builder import (
    BitcoinWalletError,
    build_and_sign_op_return_tx,
    p2wpkh_address,
    private_key_from_wif,
)
from content.models import Content, ContentTranscript, TranscriptAnchor

logger = logging.getLogger(__name__)


class AnchorBroadcastError(Exception):
    """Business/validation error while broadcasting an anchor."""


def platform_address(network: Optional[str] = None) -> str:
    network = network or settings.BTC_NETWORK
    key = private_key_from_wif(settings.BTC_PRIVATE_KEY_WIF, network)
    return p2wpkh_address(key, network)


def ensure_pending_anchor(
    content: Content,
    *,
    network: Optional[str] = None,
    anchored_by=None,
) -> TranscriptAnchor:
    """Create or return the pending/broadcastable anchor for the current transcript hash."""
    transcript = getattr(content, 'transcript', None)
    if transcript is None:
        try:
            transcript = content.transcript
        except ContentTranscript.DoesNotExist as exc:
            raise AnchorBroadcastError('Content has no transcript') from exc
    if not transcript.text_hash:
        raise AnchorBroadcastError('Transcript has no text_hash')

    network = (network or settings.BTC_NETWORK).lower()
    existing = TranscriptAnchor.objects.filter(
        content=content,
        text_hash=transcript.text_hash,
    ).first()
    if existing is not None:
        return existing

    anchor = TranscriptAnchor(
        content=content,
        text_hash=transcript.text_hash,
        text_length=transcript.text_length,
        btc_network=network,
        anchored_by=anchored_by,
        status=TranscriptAnchor.STATUS_PENDING,
    )
    anchor.btc_op_return_hex = anchor.build_op_return_payload_hex()
    anchor.save()
    return anchor


def _payload_bytes(anchor: TranscriptAnchor) -> bytes:
    hex_payload = anchor.btc_op_return_hex or anchor.build_op_return_payload_hex()
    return bytes.fromhex(hex_payload)


@transaction.atomic
def broadcast_anchor(
    anchor: TranscriptAnchor,
    *,
    dry_run: bool = False,
    client: Optional[EsploraClient] = None,
) -> TranscriptAnchor:
    """
    Build OP_RETURN tx for ``anchor.text_hash``, broadcast (unless dry_run),
    and update status to ``btc_broadcast`` with ``btc_txid``.
    """
    if anchor.status == TranscriptAnchor.STATUS_ANCHORED and anchor.btc_txid:
        raise AnchorBroadcastError(f'Anchor {anchor.pk} already anchored ({anchor.btc_txid})')
    if anchor.status == TranscriptAnchor.STATUS_BTC_BROADCAST and anchor.btc_txid and not dry_run:
        raise AnchorBroadcastError(
            f'Anchor {anchor.pk} already broadcast ({anchor.btc_txid}); '
            'use refresh to wait for confirmations'
        )
    if not settings.BTC_PRIVATE_KEY_WIF:
        raise AnchorBroadcastError('BTC_PRIVATE_KEY_WIF is not configured')

    network = anchor.btc_network or settings.BTC_NETWORK
    client = client or EsploraClient()
    address = platform_address(network)

    try:
        utxos = client.get_address_utxos(address)
        fee_rate = client.get_recommended_fee_sat_vb()
        built = build_and_sign_op_return_tx(
            wif=settings.BTC_PRIVATE_KEY_WIF,
            network_name=network,
            op_return_payload=_payload_bytes(anchor),
            utxos=utxos,
            fee_sat_vb=fee_rate,
        )
    except (BitcoinApiError, BitcoinWalletError) as exc:
        anchor.status = TranscriptAnchor.STATUS_FAILED
        anchor.error_message = str(exc)
        anchor.save(update_fields=['status', 'error_message', 'updated_at'])
        raise AnchorBroadcastError(str(exc)) from exc

    if built.from_address != address:
        raise AnchorBroadcastError('Derived address mismatch')

    metadata = dict(anchor.metadata or {})
    metadata.update({
        'from_address': built.from_address,
        'fee_sats': built.fee_sats,
        'change_sats': built.change_sats,
        'input_sats': built.input_sats,
        'fee_sat_vb': fee_rate,
        'dry_run': dry_run,
        'raw_tx_hex': built.raw_tx_hex if dry_run else metadata.get('raw_tx_hex'),
    })

    if dry_run:
        anchor.btc_op_return_hex = anchor.btc_op_return_hex or anchor.build_op_return_payload_hex()
        anchor.metadata = metadata
        anchor.error_message = ''
        anchor.save(update_fields=['btc_op_return_hex', 'metadata', 'error_message', 'updated_at'])
        return anchor

    try:
        txid = client.broadcast(built.raw_tx_hex)
    except BitcoinApiError as exc:
        anchor.status = TranscriptAnchor.STATUS_FAILED
        anchor.error_message = str(exc)
        anchor.metadata = metadata
        anchor.save(update_fields=['status', 'error_message', 'metadata', 'updated_at'])
        raise AnchorBroadcastError(str(exc)) from exc

    explorer = {
        'signet': f'https://mempool.space/signet/tx/{txid}',
        'testnet': f'https://mempool.space/testnet/tx/{txid}',
        'testnet4': f'https://mempool.space/testnet4/tx/{txid}',
        'mainnet': f'https://mempool.space/tx/{txid}',
    }.get(network, '')
    metadata['explorer_url'] = explorer
    metadata.pop('raw_tx_hex', None)

    anchor.btc_txid = txid
    anchor.btc_op_return_hex = anchor.btc_op_return_hex or anchor.build_op_return_payload_hex()
    anchor.status = TranscriptAnchor.STATUS_BTC_BROADCAST
    anchor.error_message = ''
    anchor.metadata = metadata
    anchor.save(
        update_fields=[
            'btc_txid',
            'btc_op_return_hex',
            'status',
            'error_message',
            'metadata',
            'updated_at',
        ]
    )
    logger.info(
        'Broadcast transcript anchor %s content=%s txid=%s fee=%s',
        anchor.pk,
        anchor.content_id,
        txid,
        built.fee_sats,
    )
    return anchor


def refresh_anchor_confirmations(
    anchor: TranscriptAnchor,
    *,
    client: Optional[EsploraClient] = None,
) -> TranscriptAnchor:
    """Poll Esplora and mark anchored when enough confirmations exist."""
    if not anchor.btc_txid:
        raise AnchorBroadcastError('Anchor has no btc_txid')
    client = client or EsploraClient()
    try:
        tx = client.get_tx_status(anchor.btc_txid)
    except BitcoinApiError as exc:
        raise AnchorBroadcastError(str(exc)) from exc

    status = tx.get('status') or {}
    confirmed = bool(status.get('confirmed'))
    block_height = status.get('block_height')
    block_hash = status.get('block_hash') or ''

    # Esplora does not always return confirmations count; treat confirmed as enough.
    min_conf = max(1, int(getattr(settings, 'BTC_MIN_CONFIRMATIONS', 1)))
    confirmations = 1 if confirmed else 0
    tip = None
    if confirmed and block_height is not None:
        try:
            tip = client.get_tip_height()
            confirmations = max(1, tip - int(block_height) + 1)
        except Exception:  # noqa: BLE001
            confirmations = 1

    anchor.btc_block_height = int(block_height) if block_height is not None else anchor.btc_block_height
    anchor.btc_block_hash = block_hash or anchor.btc_block_hash
    anchor.btc_confirmations = confirmations
    update_fields = ['btc_block_height', 'btc_block_hash', 'btc_confirmations', 'updated_at']

    if confirmed and confirmations >= min_conf:
        anchor.status = TranscriptAnchor.STATUS_ANCHORED
        if not anchor.btc_confirmed_at:
            anchor.btc_confirmed_at = timezone.now()
            update_fields.append('btc_confirmed_at')
        update_fields.append('status')
        anchor.error_message = ''
        update_fields.append('error_message')

    anchor.save(update_fields=update_fields)
    return anchor
