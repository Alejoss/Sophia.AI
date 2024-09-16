from django.db import models
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class Comment(models.Model):
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    votes = models.IntegerField(default=0)
    topic = models.ForeignKey(Topic, on_delete=models.SET_NULL, null=True, blank=True, related_name='comments')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')

    def __str__(self):
        return f"Comment by {self.author.username} on {self.created_at}"

    @property
    def author_is_certified(self):
        if isinstance(self.content_object, KnowledgePath):
            # Check for a certificate for the specific KnowledgePath
            return Certificate.objects.filter(user=self.author, knowledge_path=self.content_object).exists()
        return False


# Example query to fetch comments for a specific content item
# content_item = Content.objects.get(id=content_id)
# comments = Comment.objects.filter(
#     content_type=ContentType.objects.get_for_model(content_item),
#     object_id=content_item.id
# ).select_related('author').prefetch_related('author__certificates')

