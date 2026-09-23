"""Orchestrate OP_RETURN broadcast for TranscriptAnchor rows."""
from __future__ import annotations

import logging
import threading
from contextlib import contextmanager
from typing import Optional

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone

from content.bitcoin.esplora import BitcoinApiError, EsploraClient, client_for_network
from content.bitcoin.fees import FeeBudgetError, assert_fee_within_usd_budget
from content.bitcoin.tx_builder import (
    BitcoinWalletError,
    build_and_sign_op_return_tx,
    p2wpkh_address,
    private_key_from_wif,
)
from content.models import Content, ContentTranscript, TranscriptAnchor
from content.transcript_utils import resolve_certified_plain_text

logger = logging.getLogger(__name__)

# Session advisory lock key for serializing platform-wallet UTXO use (PostgreSQL).
_BTC_WALLET_ADVISORY_LOCK_KEY = 0x0ACBCB01
_THREAD_WALLET_LOCK = threading.Lock()

SUPPORTED_BTC_NETWORKS = frozenset({
    TranscriptAnchor.BTC_NETWORK_MAINNET,
    TranscriptAnchor.BTC_NETWORK_TESTNET,
    TranscriptAnchor.BTC_NETWORK_SIGNET,
    TranscriptAnchor.BTC_NETWORK_REGTEST,
    'testnet4',
})


class AnchorBroadcastError(Exception):
    """Business/validation error while broadcasting an anchor."""


# Re-export so API/CLI can catch fee budget errors explicitly.
FeeTooHighError = FeeBudgetError


def platform_address(network: Optional[str] = None) -> str:
    network = network or settings.BTC_NETWORK
    key = private_key_from_wif(settings.BTC_PRIVATE_KEY_WIF, network)
    return p2wpkh_address(key, network)


def validate_btc_network(network: str) -> str:
    network = (network or '').strip().lower()
    if network not in SUPPORTED_BTC_NETWORKS:
        raise AnchorBroadcastError(f'Unsupported btc_network: {network}')
    return network


def set_anchor_network(anchor: TranscriptAnchor, network: str) -> TranscriptAnchor:
    """
    Set ``btc_network`` only before broadcast preparation.

    After a signed tx is persisted or a txid exists, the network is immutable so
    explorer lookups and historical proofs stay consistent.
    """
    network = validate_btc_network(network)
    meta = dict(anchor.metadata or {})
    frozen = bool(anchor.btc_txid) or bool(meta.get('signed_raw_tx_hex')) or bool(
        meta.get('predicted_txid')
    )
    if frozen and anchor.btc_network != network:
        raise AnchorBroadcastError(
            f'btc_network is immutable after broadcast preparation '
            f'(have {anchor.btc_network}, requested {network})'
        )
    if anchor.btc_network != network:
        anchor.btc_network = network
        anchor.save(update_fields=['btc_network', 'updated_at'])
    return anchor


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

    network = validate_btc_network(network or settings.BTC_NETWORK)
    certified_plain_text = resolve_certified_plain_text(transcript)

    existing = TranscriptAnchor.objects.filter(
        content=content,
        text_hash=transcript.text_hash,
    ).first()
    if existing is not None:
        if not (existing.certified_plain_text or '').strip() and certified_plain_text:
            existing.certified_plain_text = certified_plain_text
            existing.save(update_fields=['certified_plain_text', 'updated_at'])
        return existing

    anchor = TranscriptAnchor(
        content=content,
        text_hash=transcript.text_hash,
        text_length=transcript.text_length,
        certified_plain_text=certified_plain_text,
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


def _explorer_url(network: str, txid: str) -> str:
    return {
        'signet': f'https://mempool.space/signet/tx/{txid}',
        'testnet': f'https://mempool.space/testnet/tx/{txid}',
        'testnet4': f'https://mempool.space/testnet4/tx/{txid}',
        'mainnet': f'https://mempool.space/tx/{txid}',
    }.get(network, '')


@contextmanager
def _wallet_lock():
    """
    Serialize platform-wallet UTXO selection across concurrent broadcasts.

    PostgreSQL uses a session advisory lock; SQLite/tests use a process lock.
    """
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_lock(%s)', [_BTC_WALLET_ADVISORY_LOCK_KEY])
        try:
            yield
        finally:
            with connection.cursor() as cursor:
                cursor.execute(
                    'SELECT pg_advisory_unlock(%s)',
                    [_BTC_WALLET_ADVISORY_LOCK_KEY],
                )
    else:
        with _THREAD_WALLET_LOCK:
            yield


def _persist_failure(anchor_id: int, message: str) -> TranscriptAnchor:
    """
    Commit a durable ``failed`` status in its own transaction.

    Must not be called inside an outer atomic that may roll back — callers that
    wrap broadcast must release their transaction first (see paid fulfillment).
    """
    with transaction.atomic():
        anchor = TranscriptAnchor.objects.select_for_update().get(pk=anchor_id)
        if anchor.btc_txid:
            return anchor
        if anchor.status == TranscriptAnchor.STATUS_ANCHORED:
            return anchor
        anchor.status = TranscriptAnchor.STATUS_FAILED
        anchor.error_message = (message or '')[:4000]
        anchor.save(update_fields=['status', 'error_message', 'updated_at'])
        return anchor


def _mark_broadcast(
    anchor: TranscriptAnchor,
    *,
    txid: str,
    metadata: dict,
    network: str,
) -> TranscriptAnchor:
    metadata = dict(metadata or {})
    metadata['explorer_url'] = _explorer_url(network, txid)
    metadata.pop('signed_raw_tx_hex', None)
    metadata['predicted_txid'] = txid
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
        'Broadcast transcript anchor %s content=%s txid=%s',
        anchor.pk,
        anchor.content_id,
        txid,
    )
    return anchor


def _resolve_client(
    anchor: TranscriptAnchor,
    client: Optional[EsploraClient],
) -> EsploraClient:
    if client is not None:
        return client
    return client_for_network(anchor.btc_network or settings.BTC_NETWORK)


def _prepare_signed_transaction(
    anchor: TranscriptAnchor,
    *,
    dry_run: bool,
    client: EsploraClient,
) -> TranscriptAnchor:
    """
    Lock the row, build/sign if needed, and commit the signed tx identity before
    any network broadcast. Returns the refreshed anchor.
    """
    with transaction.atomic():
        locked = TranscriptAnchor.objects.select_for_update().get(pk=anchor.pk)

        if locked.status == TranscriptAnchor.STATUS_ANCHORED and locked.btc_txid:
            raise AnchorBroadcastError(
                f'Anchor {locked.pk} already anchored ({locked.btc_txid})'
            )
        if (
            locked.status == TranscriptAnchor.STATUS_BTC_BROADCAST
            and locked.btc_txid
            and not dry_run
        ):
            raise AnchorBroadcastError(
                f'Anchor {locked.pk} already broadcast ({locked.btc_txid}); '
                'use refresh to wait for confirmations'
            )
        if not settings.BTC_PRIVATE_KEY_WIF:
            raise AnchorBroadcastError('BTC_PRIVATE_KEY_WIF is not configured')

        network = validate_btc_network(locked.btc_network or settings.BTC_NETWORK)
        if locked.btc_network != network:
            locked.btc_network = network
            locked.save(update_fields=['btc_network', 'updated_at'])

        metadata = dict(locked.metadata or {})
        prepared_raw = (metadata.get('signed_raw_tx_hex') or '').strip()
        predicted_txid = (metadata.get('predicted_txid') or '').strip()

        # Reuse a previously persisted signed tx (durable retry).
        if prepared_raw and predicted_txid and not dry_run:
            return locked

        address = platform_address(network)
        try:
            utxos = client.get_address_utxos(address)
            fee_rate = client.get_recommended_fee_sat_vb()
            built = build_and_sign_op_return_tx(
                wif=settings.BTC_PRIVATE_KEY_WIF,
                network_name=network,
                op_return_payload=_payload_bytes(locked),
                utxos=utxos,
                fee_sat_vb=fee_rate,
            )
        except (BitcoinApiError, BitcoinWalletError) as exc:
            # Persist failure in a nested atomic that still rolls back with the
            # outer savepoint — caller must invoke durable failure after this
            # raises if needed. We raise a typed error and let broadcast_anchor
            # persist failure outside this atomic.
            raise AnchorBroadcastError(str(exc)) from exc

        if built.from_address != address:
            raise AnchorBroadcastError('Derived address mismatch')

        try:
            fee_usd = assert_fee_within_usd_budget(built.fee_sats)
        except FeeBudgetError as exc:
            # Temporary market condition — keep row pending for retry.
            raise AnchorBroadcastError(str(exc)) from exc

        metadata.update({
            'from_address': built.from_address,
            'fee_sats': built.fee_sats,
            'change_sats': built.change_sats,
            'input_sats': built.input_sats,
            'fee_sat_vb': fee_rate,
            'fee_usd': round(fee_usd, 6) if fee_usd else None,
            'dry_run': dry_run,
        })
        if dry_run:
            # Inspection only — do not persist a durable signed payload that
            # would freeze network identity or skip a fresh UTXO selection.
            metadata['raw_tx_hex'] = built.raw_tx_hex
            metadata['predicted_txid_dry_run'] = built.txid
            metadata.pop('signed_raw_tx_hex', None)
            metadata.pop('predicted_txid', None)
            locked.btc_op_return_hex = (
                locked.btc_op_return_hex or locked.build_op_return_payload_hex()
            )
            locked.metadata = metadata
            locked.error_message = ''
            locked.save(
                update_fields=['btc_op_return_hex', 'metadata', 'error_message', 'updated_at']
            )
            return locked

        metadata['predicted_txid'] = built.txid
        metadata['signed_raw_tx_hex'] = built.raw_tx_hex
        locked.btc_op_return_hex = (
            locked.btc_op_return_hex or locked.build_op_return_payload_hex()
        )
        locked.metadata = metadata
        locked.error_message = ''
        # Stay pending until broadcast is accepted / reconciled.
        if locked.status == TranscriptAnchor.STATUS_FAILED:
            locked.status = TranscriptAnchor.STATUS_PENDING
        locked.save(
            update_fields=[
                'btc_op_return_hex',
                'metadata',
                'error_message',
                'status',
                'updated_at',
            ]
        )
        return locked


def _submit_prepared_transaction(
    anchor: TranscriptAnchor,
    *,
    client: EsploraClient,
) -> TranscriptAnchor:
    """
    Broadcast a previously persisted signed transaction, reconciling by txid
    when the explorer already knows it (retry after uncertain acceptance).
    """
    network = validate_btc_network(anchor.btc_network or settings.BTC_NETWORK)
    metadata = dict(anchor.metadata or {})
    prepared_raw = (metadata.get('signed_raw_tx_hex') or '').strip()
    predicted_txid = (metadata.get('predicted_txid') or '').strip()
    if not prepared_raw or not predicted_txid:
        raise AnchorBroadcastError(
            f'Anchor {anchor.pk} has no prepared signed transaction to broadcast'
        )

    # Reconcile first: network may have accepted a prior attempt.
    try:
        existing = client.get_tx_or_none(predicted_txid)
    except BitcoinApiError as exc:
        raise AnchorBroadcastError(str(exc)) from exc

    if existing is not None:
        with transaction.atomic():
            locked = TranscriptAnchor.objects.select_for_update().get(pk=anchor.pk)
            return _mark_broadcast(
                locked,
                txid=predicted_txid,
                metadata=dict(locked.metadata or {}),
                network=network,
            )

    try:
        txid = client.broadcast(prepared_raw)
    except BitcoinApiError as exc:
        # Ambiguous: tx may still have been accepted. Re-check by predicted txid.
        try:
            existing = client.get_tx_or_none(predicted_txid)
        except BitcoinApiError:
            existing = None
        if existing is not None:
            txid = predicted_txid
        else:
            raise AnchorBroadcastError(str(exc)) from exc

    if txid and predicted_txid and txid != predicted_txid:
        logger.warning(
            'Broadcast returned txid %s but predicted %s for anchor %s; using returned',
            txid,
            predicted_txid,
            anchor.pk,
        )

    with transaction.atomic():
        locked = TranscriptAnchor.objects.select_for_update().get(pk=anchor.pk)
        return _mark_broadcast(
            locked,
            txid=txid or predicted_txid,
            metadata=dict(locked.metadata or {}),
            network=network,
        )


def broadcast_anchor(
    anchor: TranscriptAnchor,
    *,
    dry_run: bool = False,
    client: Optional[EsploraClient] = None,
) -> TranscriptAnchor:
    """
    Build OP_RETURN tx for ``anchor.text_hash``, broadcast (unless dry_run),
    and update status to ``btc_broadcast`` with ``btc_txid``.

    Durability: the signed raw transaction and predicted txid are committed
    before submission. Retries reconcile by txid instead of building a second
    spend of the same UTXOs. Failure status is persisted in a committed
    transaction after the prepare step raises (not rolled back by ``raise``).
    """
    if anchor.pk is None:
        raise AnchorBroadcastError('Anchor must be saved before broadcast')

    resolved_client: Optional[EsploraClient] = client
    try:
        with _wallet_lock():
            # Bind Esplora to the row's network unless the caller injected a mock.
            if resolved_client is None:
                refreshed = TranscriptAnchor.objects.get(pk=anchor.pk)
                resolved_client = _resolve_client(refreshed, None)

            prepared = _prepare_signed_transaction(
                anchor,
                dry_run=dry_run,
                client=resolved_client,
            )
            if dry_run:
                return prepared
            return _submit_prepared_transaction(prepared, client=resolved_client)
    except AnchorBroadcastError as exc:
        from content.bitcoin.fees import FEE_TOO_HIGH_MESSAGE

        # Fee-too-high must remain pending for retry.
        if isinstance(exc.__cause__, FeeBudgetError) or str(exc) == FEE_TOO_HIGH_MESSAGE:
            raise
        # Durable failed state for wallet/API errors during prepare.
        # If a signed tx was already persisted, leave pending so retry reuses it.
        current = TranscriptAnchor.objects.filter(pk=anchor.pk).first()
        if current is not None and not current.btc_txid:
            meta = dict(current.metadata or {})
            has_prepared = bool(meta.get('signed_raw_tx_hex')) and bool(
                meta.get('predicted_txid')
            )
            if not has_prepared:
                _persist_failure(anchor.pk, str(exc))
        raise


def refresh_anchor_confirmations(
    anchor: TranscriptAnchor,
    *,
    client: Optional[EsploraClient] = None,
) -> TranscriptAnchor:
    """
    Poll Esplora and mark anchored when enough confirmations exist.

    If an already-anchored transaction later falls below the confirmation
    threshold (reorg), demote status back to ``btc_broadcast``.
    """
    if not anchor.btc_txid:
        raise AnchorBroadcastError('Anchor has no btc_txid')
    client = client or _resolve_client(anchor, None)
    try:
        tx = client.get_tx_status(anchor.btc_txid)
    except BitcoinApiError as exc:
        raise AnchorBroadcastError(str(exc)) from exc

    status = tx.get('status') or {}
    confirmed = bool(status.get('confirmed'))
    block_height = status.get('block_height')
    block_hash = status.get('block_hash') or ''

    min_conf = max(1, int(getattr(settings, 'BTC_MIN_CONFIRMATIONS', 1)))
    confirmations = 1 if confirmed else 0
    if confirmed and block_height is not None:
        try:
            tip = client.get_tip_height()
            confirmations = max(1, tip - int(block_height) + 1)
        except Exception:  # noqa: BLE001
            confirmations = 1
    elif not confirmed:
        confirmations = 0

    with transaction.atomic():
        locked = TranscriptAnchor.objects.select_for_update().get(pk=anchor.pk)
        was_anchored = locked.status == TranscriptAnchor.STATUS_ANCHORED
        locked.btc_block_height = (
            int(block_height) if block_height is not None else locked.btc_block_height
        )
        locked.btc_block_hash = block_hash or locked.btc_block_hash
        locked.btc_confirmations = confirmations
        update_fields = [
            'btc_block_height',
            'btc_block_hash',
            'btc_confirmations',
            'updated_at',
        ]

        if confirmed and confirmations >= min_conf:
            locked.status = TranscriptAnchor.STATUS_ANCHORED
            if not locked.btc_confirmed_at:
                locked.btc_confirmed_at = timezone.now()
                update_fields.append('btc_confirmed_at')
            update_fields.append('status')
            locked.error_message = ''
            update_fields.append('error_message')
            meta = dict(locked.metadata or {})
            if meta.pop('reorg_demoted_at', None) is not None:
                locked.metadata = meta
                update_fields.append('metadata')
        elif was_anchored and confirmations < min_conf:
            locked.status = TranscriptAnchor.STATUS_BTC_BROADCAST
            update_fields.append('status')
            meta = dict(locked.metadata or {})
            meta['reorg_demoted_at'] = timezone.now().isoformat()
            meta['reorg_confirmations'] = confirmations
            locked.metadata = meta
            update_fields.append('metadata')
            logger.warning(
                'Demoted transcript anchor %s to btc_broadcast after reorg '
                '(confirmations=%s)',
                locked.pk,
                confirmations,
            )

        locked.save(update_fields=update_fields)
        return locked


def maybe_refresh_broadcast_anchor(
    anchor: TranscriptAnchor,
    *,
    client: Optional[EsploraClient] = None,
) -> TranscriptAnchor:
    """
    Best-effort confirmation poll for anchors with a ``btc_txid``.

    Refreshes both ``btc_broadcast`` (promotion) and ``anchored`` (reorg
    demotion). Failures leave the row unchanged.
    """
    if (
        anchor is None
        or not anchor.btc_txid
        or anchor.status
        not in (
            TranscriptAnchor.STATUS_BTC_BROADCAST,
            TranscriptAnchor.STATUS_ANCHORED,
        )
    ):
        return anchor
    try:
        return refresh_anchor_confirmations(anchor, client=client)
    except Exception as exc:  # noqa: BLE001 — never break public reads
        logger.warning(
            'Could not refresh transcript anchor %s confirmations: %s',
            anchor.pk,
            exc,
        )
        return anchor
