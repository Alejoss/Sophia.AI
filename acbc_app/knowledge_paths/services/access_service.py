"""Access control for paid knowledge paths."""

from knowledge_paths.models import KnowledgePath, KnowledgePathPurchase, PathPledge, PathProposal
from payments.bch_cashaddr import CashAddrError, normalize_cashaddr


def user_has_path_access(
    user,
    knowledge_path: KnowledgePath,
    book_club=None,
    wallet_address=None,
) -> bool:
    """
    Whether the user may enter nodes of this path.

    Free paths are open. Authors always have access. Book-club members accessing
    via club context bypass the paywall (club schedule still applies separately
    for non-staff, non-author viewers). Otherwise a PAID KnowledgePathPurchase
    is required.

    A path created by a funding proposal stays closed until the campaign is
    claimed. After that, the author still has access, and a learner has access
    when the connected wallet holds a settled pledge NFT.
    """
    proposal = _funding_proposal(knowledge_path)
    if proposal is not None:
        return _funding_access(user, knowledge_path, proposal, wallet_address)

    if not knowledge_path.is_paid_path:
        return True

    if user is None or not getattr(user, 'is_authenticated', False):
        return False

    if knowledge_path.author_id == user.id:
        return True

    if book_club is not None:
        if book_club.user_can_manage(user) or book_club.user_is_member(user):
            return True

    return KnowledgePathPurchase.objects.filter(
        user=user,
        knowledge_path=knowledge_path,
        payment_status='PAID',
    ).exists()


def get_user_purchase(user, knowledge_path: KnowledgePath):
    if user is None or not getattr(user, 'is_authenticated', False):
        return None
    return (
        KnowledgePathPurchase.objects.filter(user=user, knowledge_path=knowledge_path)
        .order_by('-created_at')
        .first()
    )


def resolve_request_path_access(user, knowledge_path: KnowledgePath, request=None):
    """
    Resolve book-club context from the request (optional ``club`` query param)
    and return whether the user may access the paid path.
    """
    book_club = None
    if request is not None:
        from book_clubs.services import resolve_book_club_context

        book_club = resolve_book_club_context(
            knowledge_path,
            user,
            request.query_params.get('club'),
        )
    return (
        user_has_path_access(
            user,
            knowledge_path,
            book_club=book_club,
            wallet_address=wallet_from_request(request),
        ),
        book_club,
    )


def wallet_from_request(request) -> str | None:
    if request is None:
        return None
    params = getattr(request, 'query_params', None)
    if params is None:
        params = getattr(request, 'GET', None)
    if params is None:
        return None
    return params.get('wallet')


def funding_visibility_error(knowledge_path: KnowledgePath) -> str | None:
    """Spanish message when a funding path cannot be published yet."""
    proposal = _funding_proposal(knowledge_path)
    if proposal is None or proposal.status == PathProposal.STATUS_CLAIMED:
        return None
    return (
        'El camino se publica cuando la campaña fue cobrada y tiene al menos un nodo.'
    )


def _funding_proposal(knowledge_path: KnowledgePath):
    try:
        return knowledge_path.funding_proposal
    except PathProposal.DoesNotExist:
        return None


def _funding_access(user, knowledge_path, proposal, wallet_address) -> bool:
    if (
        user is not None
        and getattr(user, 'is_authenticated', False)
        and knowledge_path.author_id == user.id
    ):
        return True
    if proposal.status != PathProposal.STATUS_CLAIMED:
        return False
    if not wallet_address:
        return False
    try:
        wallet = normalize_cashaddr(wallet_address)
    except CashAddrError:
        return False
    return proposal.pledges.filter(
        status=PathPledge.STATUS_SETTLED,
        wallet_address=wallet,
    ).exists()
