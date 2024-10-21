from rest_framework.permissions import BasePermission

class IsAuthor(BasePermission):
    """
    Custom permission to only allow authors of a comment or admins to edit or delete it.
    """

    def has_object_permission(self, request, view, obj):
        # Check if the user is the author of the comment or an admin
        return obj.author == request.user