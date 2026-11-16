"""Unsigned spend descriptions for the campaign page.

The browser builds and the wallet signs. This module does not broadcast.
"""

from __future__ import annotations

from knowledge_paths.models import PathPledge, PathProposal
from knowledge_paths.services.funding_contract import (
    DUST_SATS,
    MIN_PLEDGE_SATS,
    constructor_args,
)
from knowledge_paths.services.proposal_service import ProposalError
from payments.bch_client import BchApiError


def campaign_snapshot(proposal: PathProposal, *, client) -> dict:
    return _campaign_output(proposal, client)


def refund_spend(proposal: PathProposal, pledge: PathPledge, *, client) -> dict:
    if proposal.status not in (PathProposal.STATUS_OPEN, PathProposal.STATUS_EXPIRED):
        raise ProposalError('This campaign is not refundable.')
    if pledge.status != PathPledge.STATUS_CONFIRMED or pledge.proposal_id != proposal.pk:
        raise ProposalError('Only a confirmed pledge can be refunded.')
    return _spec(proposal, 'refund', client=client, pledge=pledge)


def claim_spend(proposal: PathProposal, *, client) -> dict:
    if proposal.status != PathProposal.STATUS_FUNDED:
        raise ProposalError('Only a funded campaign can be claimed.')
    return _spec(proposal, 'claim', client=client, pledge=None)


def _spec(proposal, action, *, client, pledge) -> dict:
    campaign = _campaign_output(proposal, client)
    payload = {
        'action': action,
        'constructor_args': constructor_args(proposal),
        'dust_sats': DUST_SATS,
        'min_pledge_sats': MIN_PLEDGE_SATS,
        'contract_address': proposal.contract_address,
        'token_category': proposal.token_category,
        'author_payout_address': proposal.author_payout_address,
        'campaign': campaign,
        'nft': None,
    }
    if pledge is not None:
        payload['nft'] = {
            'txid': pledge.nft_txid,
            'vout': pledge.nft_vout,
            'satoshis': DUST_SATS,
            'category': pledge.nft_category,
            'commitment': pledge.nft_commitment,
            'wallet_address': pledge.wallet_address,
            'amount_sats': pledge.amount_sats,
        }
    return payload


def _campaign_output(proposal: PathProposal, client) -> dict:
    if not proposal.campaign_txid or proposal.campaign_vout is None:
        raise ProposalError('The campaign coin is not on chain yet.')
    try:
        tx = client.get_transaction(proposal.campaign_txid)
    except BchApiError as exc:
        raise ProposalError('The campaign transaction could not be loaded.') from exc
    for output in tx.outputs:
        if output.vout == proposal.campaign_vout:
            token = output.token
            return {
                'txid': proposal.campaign_txid,
                'vout': proposal.campaign_vout,
                'satoshis': output.amount_sats,
                'category': token.category if token else proposal.token_category,
                'commitment': token.commitment if token else '',
                'capability': token.capability if token else 'minting',
            }
    raise ProposalError('The campaign output is missing from the transaction.')
