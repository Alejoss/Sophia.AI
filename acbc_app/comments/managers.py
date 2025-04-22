from django.db import models
from django.contrib.contenttypes.models import ContentType


class CommentManager(models.Manager):
    def logic_delete(self, comment):
        """Logically delete a comment and all its replies by setting is_active to False."""
        print(f"\n=== Starting logic_delete for comment {comment.id} ===")
        
        # Recursively delete replies
        replies = comment.replies.all()
        print(f"Found {replies.count()} replies for comment {comment.id}")
        
        for reply in replies:
            print(f"Recursively deleting reply {reply.id} of comment {comment.id}")
            self.logic_delete(reply)
        
        # Mark the comment as inactive
        print(f"Marking comment {comment.id} as inactive")
        comment.is_active = False
        comment.save()
        print(f"Successfully marked comment {comment.id} as inactive")

    def get_for_object(self, obj):
        """Get all comments for a specific object"""
        content_type = ContentType.objects.get_for_model(obj)
        return self.filter(
            content_type=content_type,
            object_id=obj.id
        )

    def get_root_comments(self, obj):
        """Get only top-level comments"""
        return self.get_for_object(obj).filter(parent=None)
