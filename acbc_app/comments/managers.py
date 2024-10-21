from django.db import models


class CommentManager(models.Manager):
    def logic_delete(self, comment):
        """Logically delete a comment by setting is_active to False."""
        comment.is_active = False  # Mark the comment as inactive
        comment.save()