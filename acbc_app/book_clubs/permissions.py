from rest_framework.permissions import BasePermission

from django.contrib.contenttypes.models import ContentType

from book_clubs.models import BookClub, BookClubMembership, DiscussionQuestion, MembershipRole
from comments.models import Comment


class IsBookClubMember(BasePermission):
    """Object-level: user must be a member of the book club."""

    def has_object_permission(self, request, view, obj):
        club = obj if isinstance(obj, BookClub) else getattr(obj, 'book_club', None)
        if club is None:
            return False
        return club.user_is_member(request.user)


class IsBookClubMentorOrAdmin(BasePermission):
    """Object-level: mentor/admin of the club (or staff)."""

    def has_object_permission(self, request, view, obj):
        club = obj if isinstance(obj, BookClub) else getattr(obj, 'book_club', None)
        if club is None:
            return False
        return club.user_can_manage(request.user)


def get_membership(club, user):
    if not user or not user.is_authenticated:
        return None
    return BookClubMembership.objects.filter(book_club=club, user=user).first()


def user_can_view_question(question, user):
    """Members see open/closed; mentors also see drafts."""
    club = question.book_club
    if not club.user_is_member(user):
        return False
    if question.status == 'draft':
        return club.user_can_manage(user)
    return True


def user_can_answer_question(question, user):
    if not question.book_club.user_is_member(user):
        return False
    question.apply_schedule()
    return question.status == 'open'


def user_has_answered(question, user):
    """True if the user has an active top-level answer on this question."""
    if not user or not user.is_authenticated:
        return False
    ct = ContentType.objects.get_for_model(DiscussionQuestion)
    return Comment.objects.filter(
        content_type=ct,
        object_id=question.id,
        author=user,
        parent=None,
        is_active=True,
    ).exists()


def user_can_see_answers(question, user):
    """
    Post-to-see: members see others' answers only after posting their own.
    Mentors/admins/staff can see without answering.
    Soft-deleting your answer re-locks the thread.
    """
    if not user or not user.is_authenticated:
        return False
    if question.book_club.user_can_manage(user):
        return True
    return user_has_answered(question, user)
