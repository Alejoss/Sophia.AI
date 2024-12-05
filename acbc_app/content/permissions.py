from rest_framework.permissions import BasePermission


class IsCreator(BasePermission):
    """
    Custom permission to only allow creator of a topic to edit or delete it.
    """

    def has_object_permission(self, request, view, obj):
        # Check if the user is the creator of the Topic
        return obj.creator == request.user


class IsCreatorOrModerator(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.is_moderator_or_creator(request.user)