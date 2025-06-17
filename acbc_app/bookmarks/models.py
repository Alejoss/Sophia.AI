from django.db import models
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

class Bookmark(models.Model):
    """
    A flexible bookmark model that can be used to bookmark any type of content
    using Django's ContentType framework.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookmarks')
    
    # The main content being bookmarked
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # For content in topics, store the topic reference
    topic = models.ForeignKey('content.Topic', on_delete=models.CASCADE, null=True, blank=True)
    
    # Soft delete field
    deleted = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [
            ('user', 'content_type', 'object_id', 'topic')
        ]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'content_type', 'object_id']),
            models.Index(fields=['user', 'topic']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        topic_str = f" in topic {self.topic}" if self.topic else ""
        return f"{self.user.username}'s bookmark of {self.content_object}{topic_str}"

    @classmethod
    def create_bookmark(cls, user, obj, topic=None):
        """
        Create a bookmark for any object, optionally with topic context for content.
        
        Args:
            user: The user creating the bookmark
            obj: The object to bookmark
            topic: Optional topic for content bookmarks
            
        Returns:
            The created bookmark
        """
        content_type = ContentType.objects.get_for_model(obj)
        
        bookmark, created = cls.objects.get_or_create(
            user=user,
            content_type=content_type,
            object_id=obj.id,
            topic=topic,
            defaults={'deleted': False}
        )
        return bookmark

    @classmethod
    def remove_bookmark(cls, user, obj, topic=None):
        """
        Soft delete a bookmark for any object, optionally with topic context for content.
        
        Args:
            user: The user removing the bookmark
            obj: The object to unbookmark
            topic: Optional topic for content bookmarks
            
        Returns:
            True if bookmark was removed, False if it didn't exist
        """
        content_type = ContentType.objects.get_for_model(obj)
        
        try:
            bookmark = cls.objects.get(
                user=user,
                content_type=content_type,
                object_id=obj.id,
                topic=topic
            )
            bookmark.deleted = True
            bookmark.save()
            return True
        except cls.DoesNotExist:
            return False

    @classmethod
    def get_user_bookmarks(cls, user, model_class=None, topic=None):
        """
        Get all non-deleted bookmarks for a user, optionally filtered by model type and topic.
        
        Args:
            user: The user whose bookmarks to get
            model_class: Optional model class to filter by
            topic: Optional topic to filter by
            
        Returns:
            QuerySet of bookmarks
        """
        queryset = cls.objects.filter(user=user, deleted=False)
        
        if model_class:
            content_type = ContentType.objects.get_for_model(model_class)
            queryset = queryset.filter(content_type=content_type)
            
        if topic:
            queryset = queryset.filter(topic=topic)
            
        return queryset 