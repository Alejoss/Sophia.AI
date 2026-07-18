from django.utils import timezone

from book_clubs.models import BookClub, BookClubMissionRelease


def resolve_book_club_context(knowledge_path, user, slug=None):
    """
    Resolve the club schedule that applies to a user on a knowledge path.

    A valid explicit slug wins. Without one, a club linked to this path still
    applies to its members, preventing schedule bypass by deleting ?club=.
    Non-members keep the normal knowledge-path experience.
    """
    if not user or not user.is_authenticated:
        return None

    clubs = BookClub.objects.filter(knowledge_path=knowledge_path)
    if slug:
        club = clubs.filter(slug=slug).first()
        if club and (club.user_is_member(user) or club.user_can_manage(user)):
            return club

    if user.is_staff or user.is_superuser:
        return None

    return (
        clubs.filter(memberships__user=user)
        .distinct()
        .order_by('-starts_at', '-created_at')
        .first()
    )


def get_collective_release(node, club):
    """Return (released, opens_at) for a node in a club context."""
    if club is None:
        return True, None

    release = BookClubMissionRelease.objects.filter(
        book_club=club,
        node=node,
    ).first()
    opens_at = release.opens_at if release else None

    # A newly created club/path remains usable: its first mission opens at the
    # club start (or immediately if no start exists). Later unscheduled nodes
    # stay locked until staff assigns a date.
    if release is None and node.get_preceding_node() is None:
        opens_at = club.starts_at or club.created_at
        return opens_at <= timezone.now(), opens_at

    return bool(opens_at and opens_at <= timezone.now()), opens_at


def is_node_released_for_club(node, club, user):
    if club is None or club.user_can_manage(user):
        return True, None
    return get_collective_release(node, club)
