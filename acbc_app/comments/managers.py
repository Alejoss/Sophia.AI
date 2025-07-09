from django.db import models
from django.contrib.contenttypes.models import ContentType
import logging

# Get logger for comments managers
logger = logging.getLogger('academia_blockchain.comments.managers')


class CommentManager(models.Manager):
    def logic_delete(self, comment):
        """Logically delete a comment and all its replies by setting is_active to False."""
        logger.info("Starting logical delete for comment", extra={
            'comment_id': comment.id,
            'user_id': comment.user.id,
        })
        
        # Recursively delete replies
        replies = comment.replies.all()
        logger.debug("Found replies for comment", extra={
            'comment_id': comment.id,
            'reply_count': replies.count(),
        })
        
        for reply in replies:
            logger.debug("Recursively deleting reply", extra={
                'reply_id': reply.id,
                'parent_comment_id': comment.id,
            })
            self.logic_delete(reply)
        
        # Mark the comment as inactive
        logger.info("Marking comment as inactive", extra={
            'comment_id': comment.id,
        })
        comment.is_active = False
        comment.save()
        logger.info("Successfully marked comment as inactive", extra={
            'comment_id': comment.id,
        })

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
