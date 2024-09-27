from django.db import models
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

from content.models import Topic, Content  # Assuming the Topic model is defined in the content app


class Vote(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    value = models.IntegerField(default=1)  # Typically 1 or -1 for up/down votes
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='votes')  # Track the topic of each vote
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Ensure a user can only vote once per content object per topic
        indexes = [
            models.Index(fields=['content_type', 'object_id', 'topic']),
            models.Index(fields=['value']),  # If filtering or sorting on value is common
        ]
        unique_together = ('user', 'content_type', 'object_id', 'topic')
        unique_together = ('user', 'content_type', 'object_id', 'topic')

    def __str__(self):
        return f"Vote by {self.user.username} for {self.content_type.model} ID {self.object_id} in {self.topic.title}"



class ContentVoteTopic(models.Model):
    content = models.ForeignKey(Content, on_delete=models.CASCADE, related_name='vote_summaries')
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='vote_summaries')
    vote_count = models.IntegerField(default=0)

    class Meta:
        unique_together = ('content', 'topic')

    def __str__(self):
        return f"{self.vote_count} votes for {self.content.title} in {self.topic.title}"


