from django.db import models
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

from content.models import Topic, Content, KnowledgePath


class Vote(models.Model):
    # Tracks individual user votes for various content types, ensuring uniqueness of votes per content object per topic.

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


class ContentVoteTopicCount(models.Model):
    # Aggregates votes for content items within topics, updating and summarizing total votes to facilitate quick retrieval.
    content = models.ForeignKey(Content, on_delete=models.CASCADE, related_name='vote_summaries')
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='vote_summaries')
    vote_count = models.IntegerField(default=0)

    class Meta:
        unique_together = ('content', 'topic')

    def __str__(self):
        return f"{self.vote_count} votes for {self.content.title} in {self.topic.title}"

    def update_vote_count(self, new_votes=1):
        """ Update the vote count by a specified number of new votes. """
        # Using F() expression to avoid race conditions
        self.vote_count = models.F('vote_count') + new_votes
        self.save()
        self.refresh_from_db()  # Refresh to get the updated vote_count after F() expression


class KnowledgePathVoteCount(models.Model):
    # Maintains a summary of votes for each KnowledgePath within a given topic, enabling efficient vote count updates and access.

    knowledge_path = models.ForeignKey(KnowledgePath, on_delete=models.CASCADE, related_name='vote_summaries')
    vote_count = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.vote_count} votes for {self.knowledge_path.title} in {self.topic.title}"

    def update_vote_count(self, new_votes=1):
        """ Update the vote count by a specified number of new votes. """
        self.vote_count = models.F('vote_count') + new_votes
        self.save()
        self.refresh_from_db()  # Refresh to get the updated vote_count after F() expression
