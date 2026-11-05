from rest_framework.permissions import BasePermission
import logging

# Get logger for permissions
logger = logging.getLogger('academia_blockchain.permissions')

def user_owns(request, owner_id):
    """True when the authenticated caller is the object owner.

    Views must call this on every update or delete. Authentication alone only
    proves who the caller is; the object id in the URL is not an authorization.
    """
    user = getattr(request, 'user', None)
    return bool(
        user
        and user.is_authenticated
        and owner_id is not None
        and user.id == owner_id
    )


class IsAuthor(BasePermission):
    """
    Custom permission to only allow authors of a comment or admins to edit or delete it.
    """

    def has_object_permission(self, request, view, obj):
        if not hasattr(obj, 'author') or obj.author is None:
            return False
        is_author = obj.author == request.user
        logger.debug(
            "Permission check for IsAuthor",
            extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'username': request.user.username if request.user.is_authenticated else None,
                'object_type': type(obj).__name__,
                'object_id': getattr(obj, 'id', None),
                'object_author_id': obj.author.id,
                'is_authorized': is_author,
                'view_action': getattr(view, 'action', 'unknown'),
            },
        )
        return is_author