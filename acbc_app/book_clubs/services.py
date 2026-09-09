from django.utils import timezone

from book_clubs.models import BookClub, BookClubMissionRelease


def resolve_book_club_context(knowledge_path, user, slug=None):
    """
    Resolve the club schedule that applies on a knowledge path.

    When a path is linked to one or more book clubs, the mission schedule
    applies to every viewer (members and non-members). An explicit ``?club=``
    slug selects that club when it belongs to the path; otherwise the viewer's
    membership club wins, then the latest club linked to the path.

    Release exemptions (staff / path author) are handled in
    ``is_node_released_for_club``, not here — so schedule metadata can still
    be resolved for those users when useful.
    """
    clubs = BookClub.objects.filter(knowledge_path=knowledge_path)
    if slug:
        return clubs.filter(slug=slug).first()

    if user and getattr(user, 'is_authenticated', False):
        member_club = (
            clubs.filter(memberships__user=user)
            .distinct()
            .order_by('-starts_at', '-created_at')
            .first()
        )
        if member_club:
            return member_club

    return clubs.order_by('-starts_at', '-created_at').first()


def get_collective_release(node, club):
    """Return (released, opens_at) for a node in a club context.

    Nodes are open by default. A mission is schedule-locked only when staff
    sets an explicit future ``opens_at``. Missing release rows or ``opens_at=None``
    mean the mission is already available (sequential prerequisites still apply).
    """
    if club is None:
        return True, None

    release = BookClubMissionRelease.objects.filter(
        book_club=club,
        node=node,
    ).first()
    opens_at = release.opens_at if release else None
    if opens_at is None:
        return True, None
    return opens_at <= timezone.now(), opens_at


def is_node_released_for_club(node, club, user):
    """
    Whether ``user`` may open ``node`` under the club schedule.

    Staff/superusers and the knowledge-path author always bypass the schedule.
    Everyone else follows ``BookClubMissionRelease.opens_at``.
    """
    if club is None:
        return True, None
    if user and getattr(user, 'is_authenticated', False):
        if club.user_can_manage(user):
            return True, None
        if node.knowledge_path.author_id == user.id:
            return True, None
    return get_collective_release(node, club)
