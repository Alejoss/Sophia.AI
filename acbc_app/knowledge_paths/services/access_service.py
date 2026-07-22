"""Access control for paid knowledge paths."""

from knowledge_paths.models import KnowledgePath, KnowledgePathPurchase


def user_has_path_access(user, knowledge_path: KnowledgePath, book_club=None) -> bool:
    """
    Whether the user may enter nodes of this path.

    Free paths are open. Authors always have access. Book-club members accessing
    via club context bypass the paywall (club schedule still applies separately).
    Otherwise a PAID KnowledgePathPurchase is required.
    """
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
    return user_has_path_access(user, knowledge_path, book_club=book_club), book_club
