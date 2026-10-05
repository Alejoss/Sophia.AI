"""Bitcoin OP_RETURN anchors for published knowledge-path snapshot digests."""

from __future__ import annotations

from typing import Any, Optional

from django.conf import settings

from content.bitcoin.service import (
    AnchorBroadcastError,
    broadcast_anchor,
    maybe_refresh_broadcast_anchor,
    refresh_anchor_confirmations,
    set_anchor_network,
    validate_btc_network,
)
from knowledge_paths.models import (
    KnowledgePathSnapshotAnchor,
    PublishedKnowledgePathSnapshot,
)


class SnapshotAnchorError(ValueError):
    """Knowledge-path snapshot could not be anchored."""


def ensure_pending_snapshot_anchor(
    snapshot: PublishedKnowledgePathSnapshot,
    *,
    network: Optional[str] = None,
    anchored_by=None,
) -> KnowledgePathSnapshotAnchor:
    """Create or return the Bitcoin anchor row for a published snapshot digest."""
    if snapshot is None or snapshot.pk is None:
        raise SnapshotAnchorError('Published snapshot is required')
    digest = (snapshot.digest or '').strip().lower()
    if len(digest) != 64:
        raise SnapshotAnchorError('Published snapshot has no valid digest')

    network = validate_btc_network(network or settings.BTC_NETWORK)
    existing = getattr(snapshot, 'bitcoin_anchor', None)
    if existing is None:
        try:
            existing = snapshot.bitcoin_anchor
        except KnowledgePathSnapshotAnchor.DoesNotExist:
            existing = None

    if existing is not None:
        if existing.digest != digest:
            # Snapshot rows are immutable; digest drift would mean a bad row.
            raise SnapshotAnchorError(
                'Existing anchor digest does not match published snapshot digest'
            )
        if anchored_by is not None and existing.anchored_by_id is None:
            existing.anchored_by = anchored_by
            existing.save(update_fields=['anchored_by', 'updated_at'])
        return set_anchor_network(existing, network)

    anchor = KnowledgePathSnapshotAnchor(
        snapshot=snapshot,
        digest=digest,
        btc_network=network,
        anchored_by=anchored_by,
        status=KnowledgePathSnapshotAnchor.STATUS_PENDING,
    )
    anchor.btc_op_return_hex = anchor.build_op_return_payload_hex()
    anchor.save()
    return anchor


def broadcast_snapshot_anchor(
    anchor: KnowledgePathSnapshotAnchor,
    *,
    dry_run: bool = False,
    client=None,
) -> KnowledgePathSnapshotAnchor:
    """Broadcast (or dry-run) the OP_RETURN for a KP snapshot digest."""
    try:
        return broadcast_anchor(anchor, dry_run=dry_run, client=client)
    except AnchorBroadcastError as exc:
        raise SnapshotAnchorError(str(exc)) from exc


def refresh_snapshot_anchor_confirmations(
    anchor: KnowledgePathSnapshotAnchor,
    *,
    client=None,
) -> KnowledgePathSnapshotAnchor:
    try:
        return refresh_anchor_confirmations(anchor, client=client)
    except AnchorBroadcastError as exc:
        raise SnapshotAnchorError(str(exc)) from exc


def serialize_snapshot_anchor(anchor: Optional[KnowledgePathSnapshotAnchor]) -> dict[str, Any]:
    if anchor is None:
        return {
            'status': 'none',
            'network': None,
            'txid': None,
            'confirmations': 0,
            'explorerUrl': None,
            'opReturnPrefix': KnowledgePathSnapshotAnchor.DEFAULT_OP_RETURN_PREFIX,
            'digest': None,
            'errorMessage': '',
            'message': 'No Bitcoin anchor yet for this published snapshot.',
        }

    maybe_refresh_broadcast_anchor(anchor)
    anchor.refresh_from_db()
    meta = dict(anchor.metadata or {})
    explorer = meta.get('explorer_url') or None
    return {
        'status': anchor.status,
        'network': anchor.btc_network or None,
        'txid': anchor.btc_txid or None,
        'confirmations': anchor.btc_confirmations or 0,
        'blockHeight': anchor.btc_block_height,
        'blockHash': anchor.btc_block_hash or None,
        'confirmedAt': (
            anchor.btc_confirmed_at.isoformat().replace('+00:00', 'Z')
            if anchor.btc_confirmed_at
            else None
        ),
        'explorerUrl': explorer,
        'opReturnPrefix': anchor.op_return_prefix,
        'opReturnHex': anchor.btc_op_return_hex or '',
        'digest': anchor.digest,
        'errorMessage': anchor.error_message or '',
        'message': _status_message(anchor),
        'metadata': {
            'feeSats': meta.get('fee_sats'),
            'feeUsd': meta.get('fee_usd'),
            'fromAddress': meta.get('from_address'),
            'dryRun': meta.get('dry_run'),
        },
    }


def blockchain_payload_for_snapshot(
    snapshot: Optional[PublishedKnowledgePathSnapshot],
) -> dict[str, Any]:
    """Shape used by readiness / dashboard (`blockchain` object)."""
    if snapshot is None:
        return {
            'status': 'none',
            'network': None,
            'txid': None,
            'message': 'No published snapshot yet; publish before anchoring on Bitcoin.',
        }
    try:
        anchor = snapshot.bitcoin_anchor
    except KnowledgePathSnapshotAnchor.DoesNotExist:
        return {
            'status': 'none',
            'network': None,
            'txid': None,
            'digest': snapshot.digest,
            'message': (
                'Snapshot is persisted in Postgres. Staff can broadcast the digest '
                'to Bitcoin OP_RETURN (prefix ACBC2).'
            ),
        }
    return serialize_snapshot_anchor(anchor)


def _status_message(anchor: KnowledgePathSnapshotAnchor) -> str:
    if anchor.status == KnowledgePathSnapshotAnchor.STATUS_ANCHORED:
        return 'Knowledge-path digest is confirmed on Bitcoin.'
    if anchor.status == KnowledgePathSnapshotAnchor.STATUS_BTC_BROADCAST:
        return 'Broadcast submitted; waiting for confirmations.'
    if anchor.status == KnowledgePathSnapshotAnchor.STATUS_FAILED:
        return anchor.error_message or 'Bitcoin broadcast failed.'
    if anchor.status == KnowledgePathSnapshotAnchor.STATUS_PENDING:
        return 'Anchor prepared; broadcast not submitted yet.'
    return ''
