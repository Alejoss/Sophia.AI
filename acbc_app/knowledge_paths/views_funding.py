"""HTTP API for knowledge-path funding campaigns."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from knowledge_paths.models import PathPledge, PathProposal
from knowledge_paths.services.funding_contract import (
    DUST_SATS,
    MIN_PLEDGE_SATS,
    constructor_args,
    load_artifact,
)
from knowledge_paths.services.funding_spend import campaign_snapshot, claim_spend, refund_spend
from knowledge_paths.services.funding_sync import apply_transaction
from knowledge_paths.services.proposal_service import (
    ProposalError,
    create_draft,
    open_proposal,
)
from payments.bch_client import BchApiError, BchTransaction, build_bch_client

_PUBLIC_STATUSES = (
    PathProposal.STATUS_OPEN,
    PathProposal.STATUS_FUNDED,
    PathProposal.STATUS_EXPIRED,
    PathProposal.STATUS_CLAIMED,
)


class ProposalUtxoView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        address = request.query_params.get('address') or ''
        try:
            utxos = build_bch_client().list_unspent(address)
        except BchApiError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        except AttributeError:
            return Response(
                {'error': 'This BCH client cannot list unspent outputs.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({'utxos': utxos})


class ProposalContractView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            'artifact': load_artifact(),
            'dust_sats': DUST_SATS,
            'min_pledge_sats': MIN_PLEDGE_SATS,
            'address_type': 'p2sh32',
        })


class ProposalListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request):
        proposals = PathProposal.objects.select_related('author', 'knowledge_path').filter(
            status__in=_PUBLIC_STATUSES,
        )
        if request.user.is_authenticated:
            mine = PathProposal.objects.select_related('author', 'knowledge_path').filter(
                author=request.user,
            )
            proposals = (proposals | mine).distinct()
        return Response([_payload(item) for item in proposals.order_by('-created_at')])

    def post(self, request):
        try:
            proposal = create_draft(
                author=request.user,
                title=request.data.get('title') or '',
                pitch=request.data.get('pitch') or '',
                goal_sats=_as_int(request.data.get('goal_sats'), 'Goal'),
                deadline=_as_deadline(request.data.get('deadline')),
                author_payout_address=request.data.get('author_payout_address') or '',
            )
        except ProposalError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_payload(proposal), status=status.HTTP_201_CREATED)


class ProposalDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, proposal_id):
        proposal = _get_visible(request, proposal_id)
        return Response(_payload(proposal, include_pledges=True))


class ProposalCampaignView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, proposal_id):
        proposal = get_object_or_404(PathProposal, pk=proposal_id)
        try:
            return Response(campaign_snapshot(proposal, client=build_bch_client()))
        except ProposalError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except BchApiError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


class ProposalOpenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, proposal_id):
        proposal = get_object_or_404(PathProposal, pk=proposal_id, author=request.user)
        txid = request.data.get('campaign_txid') or ''
        try:
            vout = _as_int(request.data.get('campaign_vout'), 'Output index')
            tx = build_bch_client().get_transaction(txid)
            output = _require_open_output(tx, vout)
            proposal = open_proposal(
                proposal,
                campaign_txid=tx.txid,
                campaign_vout=vout,
                contract_address=output.address,
                token_category=output.token.category,
            )
        except (ProposalError, BchApiError) as exc:
            code = status.HTTP_502_BAD_GATEWAY if isinstance(exc, BchApiError) else status.HTTP_400_BAD_REQUEST
            return Response({'error': str(exc)}, status=code)
        return Response(_payload(proposal))


class ProposalPledgeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, proposal_id):
        proposal = get_object_or_404(PathProposal, pk=proposal_id)
        txid = request.data.get('txid') or ''
        try:
            tx = build_bch_client().get_transaction(txid)
            apply_transaction(proposal, tx)
        except BchApiError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        proposal.refresh_from_db()
        if request.user.is_authenticated:
            PathPledge.objects.filter(
                proposal=proposal,
                pledge_txid=tx.txid,
                user__isnull=True,
            ).update(user=request.user)
        return Response(_payload(proposal, include_pledges=True))


class ProposalRefundView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, proposal_id):
        proposal = get_object_or_404(PathProposal, pk=proposal_id)
        pledge = get_object_or_404(
            PathPledge,
            pk=request.data.get('pledge_id'),
            proposal=proposal,
        )
        try:
            spec = refund_spend(proposal, pledge, client=build_bch_client())
        except ProposalError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except BchApiError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(spec)


class ProposalClaimView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, proposal_id):
        proposal = get_object_or_404(PathProposal, pk=proposal_id)
        try:
            spec = claim_spend(proposal, client=build_bch_client())
        except ProposalError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except BchApiError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(spec)


def _get_visible(request, proposal_id) -> PathProposal:
    proposal = get_object_or_404(
        PathProposal.objects.select_related('author', 'knowledge_path'),
        pk=proposal_id,
    )
    if proposal.status in _PUBLIC_STATUSES:
        return proposal
    if request.user.is_authenticated and proposal.author_id == request.user.id:
        return proposal
    return get_object_or_404(PathProposal, pk=0)


def _payload(proposal: PathProposal, *, include_pledges: bool = False) -> dict:
    data = {
        'id': proposal.pk,
        'status': proposal.status,
        'title': proposal.frozen_title or proposal.knowledge_path.title,
        'pitch': proposal.frozen_pitch or proposal.knowledge_path.description,
        'goal_sats': proposal.goal_sats,
        'raised_sats': proposal.raised_sats,
        'deadline': proposal.deadline.isoformat(),
        'author': proposal.author.username,
        'author_payout_address': proposal.author_payout_address,
        'knowledge_path_id': proposal.knowledge_path_id,
        'contract_address': proposal.contract_address,
        'token_category': proposal.token_category,
        'campaign_txid': proposal.campaign_txid,
        'campaign_vout': proposal.campaign_vout,
        'settlement_txid': proposal.settlement_txid,
        'terms_hash': proposal.terms_hash,
        'constructor_args': constructor_args(proposal),
    }
    if include_pledges:
        data['pledges'] = [
            {
                'id': pledge.pk,
                'amount_sats': pledge.amount_sats,
                'status': pledge.status,
                'wallet_address': pledge.wallet_address,
                'nft_txid': pledge.nft_txid,
                'nft_vout': pledge.nft_vout,
                'nft_commitment': pledge.nft_commitment,
            }
            for pledge in proposal.pledges.all()
        ]
    return data


def _as_int(value, label: str) -> int:
    if isinstance(value, bool) or value is None:
        raise ProposalError(f'{label} must be an integer.')
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ProposalError(f'{label} must be an integer.') from exc


def _as_deadline(value):
    parsed = parse_datetime(str(value or ''))
    if parsed is None:
        raise ProposalError('Deadline must be an ISO-8601 timestamp.')
    if timezone.is_naive(parsed):
        raise ProposalError('Deadline must include a timezone.')
    return parsed


def _require_open_output(tx: BchTransaction, vout: int):
    output = next((item for item in tx.outputs if item.vout == vout), None)
    if output is None or output.token is None or output.token.capability != 'minting':
        raise ProposalError('The campaign output must carry the minting NFT.')
    if (output.token.commitment or '').lower() not in ('00',):
        raise ProposalError('A new campaign starts in the open state.')
    if len(output.token.category) != 64:
        raise ProposalError('Token category must be 32 bytes.')
    if not output.address:
        raise ProposalError('The campaign output needs an address.')
    return output
