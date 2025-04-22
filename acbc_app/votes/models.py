from django.db import models
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db.models import Sum
from django.apps import apps

from content.models import Topic, Content
from knowledge_paths.models import KnowledgePath


class Vote(models.Model):
    # Tracks individual user votes for various content types, ensuring uniqueness of votes per content object per topic.

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    value = models.IntegerField(default=0)  # Typically 1 or -1 for up/down votes | 0 for no vote
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    topic = models.ForeignKey('content.Topic', on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Ensure a user can only vote once per content object per topic
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['value']),  # If filtering or sorting on value is common
        ]
        unique_together = ('user', 'content_type', 'object_id')

    def __str__(self):
        return f"Vote by {self.user.username} for {self.content_type.model}"

    def upvote(self):
        """Changes the vote to upvote or removes it if it already exists."""
        if self.value == 1:
            self.value = 0  # Removes the upvote
            self.save()
            return -1 # Return -1 to indicate the vote was removed

        old_value = self.value

        self.value = 1
        self.save()

        if old_value == -1:
            return 2 # Return 2 to indicate the vote was changed from downvote to upvote
        return self.value

    def downvote(self):
        """Changes the vote to downvote or removes it if it already exists."""
        if self.value == -1:
            self.value = 0  # Removes the downvote
            self.save()
            return 1 # Return 1 to indicate the vote was removed

        old_value = self.value

        self.value = -1
        self.save()

        if old_value == 1:
            return -2  # Return -2 to indicate the vote was changed from upvote to downvote
        return self.value

    @property
    def is_upvote(self):
        return self.value > 0

    @property
    def is_downvote(self):
        return self.value < 0

    @classmethod
    def get_user_votes(cls, user, content_type=None):
        """Get all votes by a user, optionally filtered by content type"""
        votes = cls.objects.filter(user=user)
        if content_type:
            votes = votes.filter(content_type=content_type)
        return votes


class VoteCount(models.Model):
    """Generic vote count aggregation for any voteable object"""
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    topic = models.ForeignKey('content.Topic', on_delete=models.CASCADE, null=True, blank=True)
    vote_count = models.IntegerField(default=0)

    class Meta:
        unique_together = ('content_type', 'object_id', 'topic')
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
        ]

    def __str__(self):
        return f"{self.vote_count} votes for {self.content_object} in {self.topic or 'all topics'}"

    def update_vote_count(self, obj=None):
        """Update vote count for the object"""
        if obj is None:
            obj = self.content_object

        # Calculate total votes using Vote model
        vote_sum = Vote.objects.filter(
            content_type=self.content_type,
            object_id=self.object_id,
        ).aggregate(Sum('value'))['value__sum'] or 0

        self.vote_count = vote_sum
        self.save()
        return self.vote_count

    @classmethod
    def get_top_voted(cls, content_type, topic=None, limit=10):
        """Get top voted objects of a specific type"""
        filters = {'content_type': content_type}
        if topic:
            filters['topic'] = topic
        return cls.objects.filter(**filters).order_by('-vote_count')[:limit]

    @property
    def positive_ratio(self):
        """Calculate the ratio of positive votes"""
        Vote = apps.get_model('votes', 'Vote')
        total_votes = Vote.objects.filter(
            content_type=self.content_type,
            object_id=self.object_id
        ).count()
        if total_votes == 0:
            return 0
        positive_votes = Vote.objects.filter(
            content_type=self.content_type,
            object_id=self.object_id,
            value__gt=0
        ).count()
        return positive_votes / total_votes