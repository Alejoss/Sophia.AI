"""Index campaign coins and pledge NFTs into PathProposal rows.

The chain is the authority after a campaign opens. Running a sync twice
does not create a second pledge for the same output.
"""

from __future__ import annotations

import logging

from knowledge_paths.models import PathPledge, PathProposal
from knowledge_paths.services.funding_contract import (
    STATE_EXPIRED,
    STATE_FUNDED,
    decode_receipt_commitment,
)
from knowledge_paths.services.proposal_service import (
    ProposalError,
    claim_proposal,
    confirm_pledge,
    record_pledge,
    refund_pledge,
)
from payments.bch_cashaddr import CashAddrError, normalize_cashaddr
from payments.bch_client import BchApiError, BchTransaction, build_bch_client

logger = logging.getLogger(__name__)

_SYNC_STATUSES = (
    PathProposal.STATUS_OPEN,
    PathProposal.STATUS_FUNDED,
    PathProposal.STATUS_EXPIRED,
)


def sync_open_proposals(*, client=None) -> int:
    """Refresh every campaign that can still change on chain."""
    chain = client or build_bch_client()
    synced = 0
    proposals = PathProposal.objects.filter(status__in=_SYNC_STATUSES).exclude(contract_address='')
    for proposal in proposals:
        sync_proposal(proposal, client=chain)
        synced += 1
    return synced


def sync_proposal(proposal: PathProposal, *, client=None) -> PathProposal:
    """Read recent transactions for one campaign address, oldest first."""
    if not proposal.contract_address:
        return proposal
    chain = client or build_bch_client()
    try:
        transactions = chain.list_recent_transactions(proposal.contract_address)
    except BchApiError:
        logger.warning(
            'Path funding sync skipped proposal %s',
            proposal.pk,
            exc_info=True,
        )
        return proposal
    for tx in reversed(list(transactions)):
        apply_transaction(proposal, tx)
        proposal.refresh_from_db()
    return proposal


def apply_transaction(proposal: PathProposal, tx: BchTransaction) -> PathProposal:
    """Apply one transaction. A second call with the same tx is a no-op."""
    proposal.refresh_from_db()
    _record_receipts(proposal, tx)
    proposal.refresh_from_db()
    _record_refunds(proposal, tx)
    proposal.refresh_from_db()
    minting = _campaign_output(proposal, tx)
    if minting is not None:
        _apply_campaign_output(proposal, tx, minting)
        proposal.refresh_from_db()
        return proposal
    if _is_author_claim(proposal, tx):
        try:
            claim_proposal(proposal, settlement_txid=tx.txid)
        except ProposalError:
            logger.info(
                'Path funding claim %s did not apply to proposal %s',
                tx.txid,
                proposal.pk,
            )
        proposal.refresh_from_db()
    return proposal


def _record_receipts(proposal: PathProposal, tx: BchTransaction) -> None:
    for output in tx.outputs:
        if not _is_receipt(proposal, output.token):
            continue
        decoded = decode_receipt_commitment(output.token.commitment)
        if decoded is None or decoded[0] != proposal.pk:
            continue
        wallet = _wallet(output.address)
        if not wallet:
            continue
        try:
            record_pledge(
                proposal,
                amount_sats=decoded[1],
                pledge_txid=tx.txid,
                vout=output.vout,
                wallet_address=wallet,
                nft_category=output.token.category,
                nft_commitment=output.token.commitment,
                nft_txid=tx.txid,
                nft_vout=output.vout,
                confirmations=tx.confirmations,
                enforce_deadline=False,
            )
        except ProposalError:
            existing = PathPledge.objects.filter(
                nft_txid=tx.txid,
                nft_vout=output.vout,
                proposal=proposal,
            ).first()
            if (
                existing is not None
                and existing.status == PathPledge.STATUS_PENDING
                and tx.confirmations >= 1
            ):
                try:
                    confirm_pledge(proposal, existing, confirmations=tx.confirmations)
                except ProposalError:
                    logger.info(
                        'Pending pledge %s stayed pending on %s',
                        existing.pk,
                        tx.txid,
                    )


def _record_refunds(proposal: PathProposal, tx: BchTransaction) -> None:
    surviving = {
        (output.token.category, output.token.commitment)
        for output in tx.outputs
        if output.token and output.token.commitment
    }
    for spent in tx.inputs:
        if not _is_receipt(proposal, spent.token):
            continue
        if (spent.token.category, spent.token.commitment) in surviving:
            continue
        pledge = PathPledge.objects.filter(
            proposal=proposal,
            nft_txid=spent.txid,
            nft_vout=spent.vout,
        ).first()
        if pledge is None:
            continue
        try:
            refund_pledge(proposal, pledge, refund_txid=tx.txid)
        except ProposalError:
            logger.info('Refund %s did not apply to pledge %s', tx.txid, pledge.pk)


def _apply_campaign_output(proposal: PathProposal, tx: BchTransaction, output) -> None:
    proposal.campaign_txid = tx.txid
    proposal.campaign_vout = output.vout
    fields = ['campaign_txid', 'campaign_vout', 'updated_at']
    state = (output.token.commitment or '').lower()
    if state == STATE_EXPIRED and proposal.status == PathProposal.STATUS_OPEN:
        proposal.status = PathProposal.STATUS_EXPIRED
        fields.append('status')
    elif (
        state == STATE_FUNDED
        and proposal.status == PathProposal.STATUS_OPEN
        and proposal.raised_sats >= proposal.goal_sats
    ):
        proposal.status = PathProposal.STATUS_FUNDED
        fields.append('status')
    proposal.save(update_fields=fields)


def _campaign_output(proposal: PathProposal, tx: BchTransaction):
    for output in tx.outputs:
        token = output.token
        if token is None or token.capability != 'minting':
            continue
        if proposal.token_category and token.category != proposal.token_category:
            continue
        if token.commitment not in (STATE_FUNDED, STATE_EXPIRED, '00'):
            continue
        if proposal.contract_address:
            wallet = _wallet(output.address)
            if wallet and wallet != proposal.contract_address:
                continue
        return output
    return None


def _is_receipt(proposal: PathProposal, token) -> bool:
    if token is None or token.capability == 'minting':
        return False
    if proposal.token_category and token.category != proposal.token_category:
        return False
    decoded = decode_receipt_commitment(token.commitment)
    return decoded is not None and decoded[0] == proposal.pk


def _is_author_claim(proposal: PathProposal, tx: BchTransaction) -> bool:
    if not proposal.campaign_txid or proposal.campaign_vout is None:
        return False
    spends_campaign = any(
        spent.txid == proposal.campaign_txid and spent.vout == proposal.campaign_vout
        for spent in tx.inputs
    )
    if not spends_campaign:
        return False
    payout = proposal.author_payout_address
    return any(
        _wallet(output.address) == payout and output.token is None and output.amount_sats > 0
        for output in tx.outputs
    )


def _wallet(address: str) -> str:
    try:
        return normalize_cashaddr(address)
    except CashAddrError:
        return ''
