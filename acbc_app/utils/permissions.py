from rest_framework.permissions import BasePermission
import logging

# Get logger for permissions
logger = logging.getLogger('academia_blockchain.permissions')

class IsAuthor(BasePermission):
    """
    Custom permission to only allow authors of a comment or admins to edit or delete it.
    """

    def has_object_permission(self, request, view, obj):
        # Check if the user is the author of the object
        is_author = obj.author == request.user
        
        logger.debug("Permission check for IsAuthor", extra={
            'user_id': request.user.id if request.user.is_authenticated else None,
            'username': request.user.username if request.user.is_authenticated else None,
            'object_type': type(obj).__name__,
            'object_id': obj.id,
            'object_author_id': obj.author.id,
            'is_authorized': is_author,
            'view_action': getattr(view, 'action', 'unknown'),
        })
        
        return is_author