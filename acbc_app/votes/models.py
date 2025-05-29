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
            models.Index(fields=['value']),
            models.Index(fields=['topic']),  # New index for topic filtering
        ]
        unique_together = ('user', 'content_type', 'object_id', 'topic')

    def __str__(self):
        topic_str = f" in {self.topic}" if self.topic else ""
        return f"Vote by {self.user.username} for {self.content_type.model}{topic_str}"

    def upvote(self):
        """Changes the vote to upvote or removes it if it already exists."""
        print(f"\n=== Vote.upvote ===")
        print(f"Current vote value: {self.value}")
        
        if self.value == 1:
            print("Removing upvote")
            self.value = 0  # Removes the upvote
            self.save()
            print("Vote saved with value 0")
            return -1 # Return -1 to indicate the vote was removed

        old_value = self.value
        print(f"Changing vote from {old_value} to 1")
        self.value = 1
        self.save()
        print("Vote saved with value 1")

        if old_value == -1:
            print("Changed from downvote to upvote")
            return 2 # Return 2 to indicate the vote was changed from downvote to upvote
        return 1 # Return 1 to indicate a new upvote

    def downvote(self):
        """Changes the vote to downvote or removes it if it already exists."""
        print(f"\n=== Vote.downvote ===")
        print(f"Current vote value: {self.value}")
        
        if self.value == -1:
            print("Removing downvote")
            self.value = 0  # Removes the downvote
            self.save()
            print("Vote saved with value 0")
            return 1 # Return 1 to indicate the vote was removed

        old_value = self.value
        print(f"Changing vote from {old_value} to -1")
        self.value = -1
        self.save()
        print("Vote saved with value -1")

        if old_value == 1:
            print("Changed from upvote to downvote")
            return -2  # Return -2 to indicate the vote was changed from upvote to downvote
        return -1 # Return -1 to indicate a new downvote

    @property
    def is_upvote(self):
        return self.value > 0

    @property
    def is_downvote(self):
        return self.value < 0

    @classmethod
    def get_user_votes(cls, user, content_type=None, topic=None):
        """Get all votes by a user, optionally filtered by content type and topic"""
        votes = cls.objects.filter(user=user)
        if content_type:
            votes = votes.filter(content_type=content_type)
        if topic:
            votes = votes.filter(topic=topic)
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
            models.Index(fields=['topic']),  # New index for topic filtering
        ]

    def __str__(self):
        topic_str = f" in {self.topic}" if self.topic else ""
        return f"{self.vote_count} votes for {self.content_object}{topic_str}"

    def update_vote_count(self, obj=None):
        """Update vote count for the object, considering topic if specified"""
        print(f"\n=== VoteCount.update_vote_count ===")
        print(f"Content Type: {self.content_type.model}")
        print(f"Object ID: {self.object_id}")
        print(f"Topic: {self.topic.id if self.topic else 'None'}")
        
        if obj is None:
            obj = self.content_object
            print(f"Using content object: {obj.id}")

        # Calculate total votes using Vote model
        vote_query = Vote.objects.filter(
            content_type=self.content_type,
            object_id=self.object_id,
        )
        
        # If this is a topic-specific vote count, filter by topic
        if self.topic:
            vote_query = vote_query.filter(topic=self.topic)
            print(f"Filtering votes for topic: {self.topic.id}")
        else:
            # For non-topic-specific votes, only count votes that are also non-topic-specific
            vote_query = vote_query.filter(topic__isnull=True)
            print("Filtering for non-topic-specific votes")

        # Get all votes with user information
        votes = vote_query.select_related('user').values('user__username', 'value')
        print("\nDetailed vote information:")
        print("------------------------")
        for vote in votes:
            vote_type = "upvote" if vote['value'] > 0 else "downvote" if vote['value'] < 0 else "no vote"
            print(f"User: {vote['user__username']}, Vote: {vote['value']} ({vote_type})")
        print("------------------------")
        
        # Get just the values for sum calculation
        vote_values = [vote['value'] for vote in votes]
        print(f"\nFound {len(vote_values)} votes")
        print(f"Vote values: {vote_values}")
        
        # Calculate the sum
        vote_sum = sum(vote_values)
        print(f"Calculated vote sum: {vote_sum}")

        # Update the vote count
        old_count = self.vote_count
        self.vote_count = vote_sum
        self.save()
        print(f"Updated vote count from {old_count} to {self.vote_count}")
        print("=== End VoteCount.update_vote_count ===\n")
        
        return self.vote_count

    @classmethod
    def get_or_create_for_object(cls, obj, topic=None):
        """Get or create a VoteCount instance for an object"""
        content_type = ContentType.objects.get_for_model(obj)
        vote_count, created = cls.objects.get_or_create(
            content_type=content_type,
            object_id=obj.id,
            topic=topic,
            defaults={'vote_count': 0}
        )
        if created:
            vote_count.update_vote_count(obj)
        return vote_count

    @classmethod
    def get_top_voted(cls, content_type, topic=None, limit=10):
        """Get top voted objects of a specific type, optionally filtered by topic"""
        filters = {'content_type': content_type}
        if topic:
            filters['topic'] = topic
        return cls.objects.filter(**filters).order_by('-vote_count')[:limit]

    @property
    def positive_ratio(self):
        """Calculate the ratio of positive votes"""
        Vote = apps.get_model('votes', 'Vote')
        vote_query = Vote.objects.filter(
            content_type=self.content_type,
            object_id=self.object_id
        )
        
        # If this is a topic-specific vote count, filter by topic
        if self.topic:
            vote_query = vote_query.filter(topic=self.topic)
        else:
            # For non-topic-specific votes, only count votes that are also non-topic-specific
            vote_query = vote_query.filter(topic__isnull=True)

        total_votes = vote_query.count()
        if total_votes == 0:
            return 0
            
        positive_votes = vote_query.filter(value__gt=0).count()
        return positive_votes / total_votes