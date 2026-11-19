"""HTTP API for knowledge-path funding campaigns."""

from __future__ import annotations

from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from knowledge_paths.models import PathPledge, PathProposal
from knowledge_paths.services.funding_contract import (
    DUST_SATS,
    MIN_PLEDGE_SATS,
    constructor_args,
    load_artifact,
)
from knowledge_paths.services.funding_spend import campaign_snapshot, claim_spend, refund_spend
from knowledge_paths.services.funding_sync import (
    apply_transaction,
    refresh_recorded_payments,
    sync_proposal,
)
from knowledge_paths.services.proposal_service import (
    ProposalError,
    create_draft,
    link_knowledge_path,
    network_cashaddr_prefix,
    open_proposal,
    set_author_payout,
    update_proposal,
)
from payments.bch_client import BchApiError, BchTransaction, build_bch_client

class _PublicJWTAuthentication(JWTAuthentication):
    """A rejected login token leaves the visitor anonymous. It does not hide a public page."""

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (InvalidToken, AuthenticationFailed):
            return None


_PUBLIC_STATUSES = (
    PathProposal.STATUS_OPEN,
    PathProposal.STATUS_FUNDED,
    PathProposal.STATUS_EXPIRED,
    PathProposal.STATUS_CLAIMED,
)


class ProposalUtxoView(APIView):
    authentication_classes = [_PublicJWTAuthentication]
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


class ProposalBchPriceView(APIView):
    authentication_classes = [_PublicJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            rate = build_bch_client().get_bch_usd_rate()
        except BchApiError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({'usd_per_bch': str(rate)})


class ProposalContractView(APIView):
    authentication_classes = [_PublicJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            'artifact': load_artifact(),
            'dust_sats': DUST_SATS,
            'min_pledge_sats': MIN_PLEDGE_SATS,
            'address_type': 'p2sh32',
        })


class ProposalListCreateView(APIView):
    authentication_classes = [_PublicJWTAuthentication]

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
    authentication_classes = [_PublicJWTAuthentication]

    def get_permissions(self):
        if self.request.method == 'PATCH':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request, proposal_id):
        proposal = _get_visible(request, proposal_id)
        if proposal.contract_address:
            proposal = sync_proposal(proposal)
        else:
            proposal = refresh_recorded_payments(proposal)
        return Response(_payload(proposal, include_pledges=True))

    def patch(self, request, proposal_id):
        proposal = get_object_or_404(PathProposal, pk=proposal_id, author=request.user)
        try:
            if any(key in request.data for key in ('title', 'pitch', 'goal_sats', 'deadline')):
                proposal = update_proposal(
                    proposal,
                    title=request.data.get('title') or '',
                    pitch=request.data.get('pitch') or '',
                    goal_sats=(
                        _as_int(request.data.get('goal_sats'), 'Goal')
                        if 'goal_sats' in request.data else None
                    ),
                    deadline=(
                        _as_deadline(request.data.get('deadline'))
                        if 'deadline' in request.data else None
                    ),
                    author_payout_address=(
                        request.data.get('author_payout_address') or ''
                        if 'author_payout_address' in request.data else None
                    ),
                )
            elif request.data.get('author_payout_address'):
                proposal = set_author_payout(
                    proposal,
                    request.data.get('author_payout_address') or '',
                )
            if 'knowledge_path_id' in request.data:
                proposal = link_knowledge_path(proposal, request.data.get('knowledge_path_id'))
        except ProposalError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_payload(proposal, include_pledges=True))


class ProposalCampaignView(APIView):
    authentication_classes = [_PublicJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, proposal_id):
        proposal = get_object_or_404(PathProposal, pk=proposal_id)
        try:
            return Response(campaign_snapshot(proposal, client=build_bch_client()))
        except ProposalError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except BchApiError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


class ProposalBroadcastView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        raw_tx = str(request.data.get('raw_tx') or '').strip()
        try:
            tx = _load_signed_payment(raw_tx, '')
        except BchApiError as exc:
            return _chain_error(exc)
        return Response({'txid': tx.txid})


class ProposalOpenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, proposal_id):
        proposal = get_object_or_404(PathProposal, pk=proposal_id, author=request.user)
        txid = request.data.get('campaign_txid') or ''
        raw_tx = str(request.data.get('raw_tx') or '').strip()
        try:
            vout = _as_int(request.data.get('campaign_vout'), 'Output index')
            tx = _load_signed_payment(raw_tx, txid)
            output = _require_open_output(tx, vout)
            proposal = open_proposal(
                proposal,
                campaign_txid=tx.txid,
                campaign_vout=vout,
                contract_address=output.address,
                token_category=output.token.category,
            )
        except BchApiError as exc:
            return _chain_error(exc)
        except ProposalError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_payload(proposal))


class ProposalPledgeView(APIView):
    authentication_classes = [_PublicJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request, proposal_id):
        proposal = get_object_or_404(PathProposal, pk=proposal_id)
        txid = request.data.get('txid') or ''
        raw_tx = str(request.data.get('raw_tx') or '').strip()
        try:
            tx = _load_signed_payment(raw_tx, txid) if raw_tx else build_bch_client().get_transaction(txid)
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
    authentication_classes = [_PublicJWTAuthentication]
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
    authentication_classes = [_PublicJWTAuthentication]
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
        'title': proposal.frozen_title or (proposal.knowledge_path.title if proposal.knowledge_path_id else ''),
        'pitch': proposal.frozen_pitch or (proposal.knowledge_path.description if proposal.knowledge_path_id else ''),
        'goal_sats': proposal.goal_sats,
        'raised_sats': proposal.raised_sats,
        'pending_sats': (
            proposal.pledges.filter(status=PathPledge.STATUS_PENDING)
            .aggregate(total=Sum('amount_sats'))
            .get('total')
            or 0
        ),
        'deadline': proposal.deadline.isoformat(),
        'author': proposal.author.username,
        'author_payout_address': proposal.author_payout_address,
        'network_prefix': network_cashaddr_prefix(),
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


def _chain_error(exc: BchApiError):
    code = exc.code or 'chain_unavailable'
    if 'no such mempool' in str(exc).lower() or 'no se pudo cargar la transacci' in str(exc).lower():
        code = 'not_published'
    message = {
        'not_published': 'The signed payment is not on the Bitcoin Cash network yet.',
        'broadcast_rejected': 'The Bitcoin Cash network rejected the signed payment.',
    }.get(code, 'The Bitcoin Cash network could not be reached.')
    http_status = status.HTTP_400_BAD_REQUEST if code == 'broadcast_rejected' else status.HTTP_502_BAD_GATEWAY
    return Response({'code': code, 'error': message}, status=http_status)


def _load_signed_payment(raw_tx: str, txid: str) -> BchTransaction:
    client = build_bch_client()
    if raw_tx and hasattr(client, 'publish'):
        return client.publish(raw_tx)
    return client.get_transaction(txid)


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
