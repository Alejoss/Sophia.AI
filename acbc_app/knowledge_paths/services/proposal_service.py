"""State machine for knowledge-path funding proposals.

Callers pass chain events in. This module does not talk to Electrum or a
wallet. Once a campaign is open, the campaign coin and the pledge NFT are
the authority. These rows are the index.

See docs/hackathon/knowledge-path-funding.md.
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone as dt_timezone

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from knowledge_paths.models import KnowledgePath, PathPledge, PathProposal
from payments.bch_cashaddr import CashAddrError, decode_cashaddr

CONFIRMATIONS_REQUIRED = 1
_TXID_RE = re.compile(r'^[0-9a-f]{64}$')
_HEX_RE = re.compile(r'^[0-9a-f]*$')
_CASHADDR_PREFIXES = frozenset({'bitcoincash', 'bchtest', 'bchreg'})
_P2PKH = 0
_P2SH = 1
_COUNTED_STATUSES = (PathPledge.STATUS_CONFIRMED, PathPledge.STATUS_SETTLED)


class ProposalError(ValueError):
    """The proposal event does not fit the current state."""


def create_draft(
    *,
    author,
    title: str,
    pitch: str,
    goal_sats: int,
    deadline: datetime,
    author_payout_address: str,
    at: datetime | None = None,
) -> PathProposal:
    """Create a hidden knowledge path and a draft proposal."""
    title = (title or '').strip()
    if not title:
        raise ProposalError('Title is required.')
    if len(title) > 200:
        raise ProposalError('Title is too long.')
    goal_sats = _positive_sats(goal_sats, 'Goal')
    deadline = _aware_deadline(deadline)
    moment = _aware(at)
    if deadline <= moment:
        raise ProposalError('Deadline must be in the future.')
    payout = _require_cashaddr(author_payout_address)

    with transaction.atomic():
        path = KnowledgePath.objects.create(
            title=title,
            description=pitch or '',
            author=author,
            is_visible=False,
            sales_enabled=False,
            reference_price=0,
        )
        return PathProposal.objects.create(
            knowledge_path=path,
            author=author,
            goal_sats=goal_sats,
            deadline=deadline,
            author_payout_address=payout,
            status=PathProposal.STATUS_DRAFT,
        )


def cancel_draft(proposal: PathProposal) -> PathProposal:
    """Cancel a proposal that has never opened."""
    with transaction.atomic():
        locked = _lock(proposal)
        if locked.status != PathProposal.STATUS_DRAFT:
            raise ProposalError('Only a draft proposal can be cancelled.')
        locked.status = PathProposal.STATUS_CANCELLED
        locked.save(update_fields=['status', 'updated_at'])
        return locked


def open_proposal(
    proposal: PathProposal,
    *,
    campaign_txid: str,
    campaign_vout: int,
    at: datetime | None = None,
) -> PathProposal:
    """Freeze the pitch and attach the campaign coin."""
    with transaction.atomic():
        locked = _lock(proposal)
        if locked.status != PathProposal.STATUS_DRAFT:
            raise ProposalError('Only a draft proposal can be opened.')
        moment = _aware(at)
        if locked.deadline <= moment:
            raise ProposalError('Deadline must be in the future.')
        path = locked.knowledge_path
        locked.frozen_title = path.title
        locked.frozen_pitch = path.description or ''
        locked.campaign_txid = _require_txid(campaign_txid)
        locked.campaign_vout = _require_vout(campaign_vout)
        locked.status = PathProposal.STATUS_OPEN
        locked.terms_hash = ''
        locked.save()
        locked.terms_hash = terms_hash(locked)
        locked.save(update_fields=['terms_hash', 'updated_at'])
        return locked


def record_pledge(
    proposal: PathProposal,
    *,
    amount_sats: int,
    pledge_txid: str,
    vout: int,
    wallet_address: str,
    nft_category: str,
    nft_commitment: str,
    nft_txid: str,
    nft_vout: int,
    confirmations: int = 0,
    user=None,
    at: datetime | None = None,
) -> tuple[PathProposal, PathPledge]:
    """Index a pledge output. One confirmation counts toward the goal."""
    amount_sats = _positive_sats(amount_sats, 'Pledge')
    pledge_txid = _require_txid(pledge_txid)
    vout = _require_vout(vout)
    nft_txid = _require_txid(nft_txid)
    nft_vout = _require_vout(nft_vout)
    wallet = _require_cashaddr(wallet_address)
    category = _require_hex(nft_category, 64, 'NFT category')
    commitment = _require_commitment(nft_commitment)
    confirmations = _nonnegative_int(confirmations, 'Confirmations')

    with transaction.atomic():
        locked = _lock(proposal)
        moment = _aware(at)
        _require_accepting_pledges(locked, moment)
        if PathPledge.objects.filter(pledge_txid=pledge_txid, vout=vout).exists():
            raise ProposalError('That pledge output is already recorded.')
        if PathPledge.objects.filter(nft_txid=nft_txid, nft_vout=nft_vout).exists():
            raise ProposalError('That NFT output is already recorded.')
        status = (
            PathPledge.STATUS_CONFIRMED
            if confirmations >= CONFIRMATIONS_REQUIRED
            else PathPledge.STATUS_PENDING
        )
        pledge = PathPledge.objects.create(
            proposal=locked,
            user=user,
            wallet_address=wallet,
            amount_sats=amount_sats,
            pledge_txid=pledge_txid,
            vout=vout,
            nft_category=category,
            nft_commitment=commitment,
            nft_txid=nft_txid,
            nft_vout=nft_vout,
            status=status,
        )
        _sync_raised_and_maybe_fund(locked)
        locked.save()
        return locked, pledge


def confirm_pledge(
    proposal: PathProposal,
    pledge: PathPledge,
    *,
    confirmations: int,
    at: datetime | None = None,
) -> PathProposal:
    """Count a pending pledge once it has a confirmation."""
    if _nonnegative_int(confirmations, 'Confirmations') < CONFIRMATIONS_REQUIRED:
        raise ProposalError('A pledge counts after one confirmation.')
    with transaction.atomic():
        locked = _lock(proposal)
        pledge = PathPledge.objects.select_for_update().get(
            pk=pledge.pk,
            proposal=locked,
        )
        if pledge.status != PathPledge.STATUS_PENDING:
            raise ProposalError('Only a pending pledge can be confirmed.')
        moment = _aware(at)
        _require_accepting_pledges(locked, moment)
        pledge.status = PathPledge.STATUS_CONFIRMED
        pledge.save(update_fields=['status', 'updated_at'])
        _sync_raised_and_maybe_fund(locked)
        locked.save()
        return locked


def refund_pledge(
    proposal: PathProposal,
    pledge: PathPledge,
    *,
    refund_txid: str,
    at: datetime | None = None,
) -> PathProposal:
    """Record a refund of a confirmed pledge while the pool is still open."""
    refund_txid = _require_txid(refund_txid)
    with transaction.atomic():
        locked = _lock(proposal)
        pledge = PathPledge.objects.select_for_update().get(
            pk=pledge.pk,
            proposal=locked,
        )
        if locked.status not in (PathProposal.STATUS_OPEN, PathProposal.STATUS_EXPIRED):
            raise ProposalError('This campaign is not refundable.')
        moment = _aware(at)
        if locked.status == PathProposal.STATUS_OPEN and moment >= locked.deadline:
            raise ProposalError('The deadline has passed. Expire the campaign before refunding.')
        if pledge.status != PathPledge.STATUS_CONFIRMED:
            raise ProposalError('Only a confirmed pledge can be refunded.')
        pledge.status = PathPledge.STATUS_REFUNDED
        pledge.refund_txid = refund_txid
        pledge.save(update_fields=['status', 'refund_txid', 'updated_at'])
        _sync_raised(locked)
        locked.save()
        return locked


def expire_if_due(proposal: PathProposal, *, at: datetime | None = None) -> PathProposal:
    """Move an open campaign that reached its deadline."""
    with transaction.atomic():
        locked = _lock(proposal)
        if locked.status != PathProposal.STATUS_OPEN:
            return locked
        moment = _aware(at)
        if moment < locked.deadline:
            return locked
        _sync_raised(locked)
        if locked.raised_sats >= locked.goal_sats:
            locked.status = PathProposal.STATUS_FUNDED
        else:
            locked.status = PathProposal.STATUS_EXPIRED
        locked.save()
        return locked


def claim_proposal(
    proposal: PathProposal,
    *,
    settlement_txid: str,
) -> PathProposal:
    """Record the author claim. Confirmed pledges become settled access tickets."""
    settlement_txid = _require_txid(settlement_txid)
    with transaction.atomic():
        locked = _lock(proposal)
        if locked.status != PathProposal.STATUS_FUNDED:
            raise ProposalError('Only a funded campaign can be claimed.')
        locked.status = PathProposal.STATUS_CLAIMED
        locked.settlement_txid = settlement_txid
        locked.save(update_fields=['status', 'settlement_txid', 'updated_at'])
        locked.pledges.filter(status=PathPledge.STATUS_CONFIRMED).update(
            status=PathPledge.STATUS_SETTLED,
            updated_at=timezone.now(),
        )
        _sync_raised(locked)
        locked.save(update_fields=['raised_sats', 'updated_at'])
        return locked


def terms_hash(proposal: PathProposal) -> str:
    """SHA-256 hex of id, goal, deadline unix seconds, and payout address."""
    if proposal.pk is None:
        raise ProposalError('The proposal must be saved before its terms are hashed.')
    deadline = _aware_deadline(proposal.deadline)
    payload = '|'.join([
        str(proposal.pk),
        str(proposal.goal_sats),
        str(int(deadline.timestamp())),
        proposal.author_payout_address,
    ])
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def _lock(proposal: PathProposal) -> PathProposal:
    return (
        PathProposal.objects.select_for_update()
        .select_related('knowledge_path')
        .get(pk=proposal.pk)
    )


def _require_accepting_pledges(proposal: PathProposal, moment: datetime) -> None:
    if proposal.status != PathProposal.STATUS_OPEN:
        raise ProposalError('Pledges are accepted only while the campaign is open.')
    if moment >= proposal.deadline:
        raise ProposalError('The campaign deadline has passed.')


def _sync_raised(proposal: PathProposal) -> None:
    total = (
        proposal.pledges.filter(status__in=_COUNTED_STATUSES)
        .aggregate(total=Sum('amount_sats'))
        .get('total')
        or 0
    )
    proposal.raised_sats = total


def _sync_raised_and_maybe_fund(proposal: PathProposal) -> None:
    _sync_raised(proposal)
    if (
        proposal.status == PathProposal.STATUS_OPEN
        and proposal.raised_sats >= proposal.goal_sats
    ):
        proposal.status = PathProposal.STATUS_FUNDED


def _aware(moment: datetime | None) -> datetime:
    if moment is None:
        return timezone.now()
    if timezone.is_naive(moment):
        raise ProposalError('Timestamp must be timezone-aware.')
    return moment.astimezone(dt_timezone.utc)


def _aware_deadline(deadline: datetime) -> datetime:
    if deadline is None or timezone.is_naive(deadline):
        raise ProposalError('Deadline must be timezone-aware.')
    return deadline.astimezone(dt_timezone.utc).replace(microsecond=0)


def _positive_sats(value: int, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ProposalError(f'{label} must be a positive number of satoshis.')
    return value


def _nonnegative_int(value: int, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ProposalError(f'{label} must be a non-negative integer.')
    return value


def _require_vout(value: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ProposalError('Output index must be a non-negative integer.')
    return value


def _require_txid(value: str) -> str:
    txid = (value or '').strip().lower()
    if not _TXID_RE.match(txid):
        raise ProposalError('Transaction id must be 64 hex characters.')
    return txid


def _require_hex(value: str, size: int, label: str) -> str:
    hex_value = (value or '').strip().lower()
    if len(hex_value) != size or not _HEX_RE.match(hex_value):
        raise ProposalError(f'{label} must be {size} hex characters.')
    return hex_value


def _require_commitment(value: str) -> str:
    hex_value = (value or '').strip().lower()
    if not hex_value or len(hex_value) > 80 or len(hex_value) % 2 or not _HEX_RE.match(hex_value):
        raise ProposalError('NFT commitment must be 1 to 40 bytes of hex.')
    return hex_value


def _require_cashaddr(address: str) -> str:
    addr = (address or '').strip()
    if ':' not in addr:
        raise ProposalError('Address must include the CashAddr prefix.')
    try:
        prefix, version, _payload = decode_cashaddr(addr)
    except CashAddrError as exc:
        raise ProposalError('Address is not a valid CashAddr.') from exc
    if prefix not in _CASHADDR_PREFIXES:
        raise ProposalError('Address prefix is not a Bitcoin Cash network.')
    if (version >> 3) not in (_P2PKH, _P2SH):
        raise ProposalError('Address must be P2PKH or P2SH.')
    return addr.lower()
