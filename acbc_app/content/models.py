from django.db import models
from django.contrib.auth.models import User


class Library(models.Model):
    #  Represents a collection of content items grouped by a specific user.
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.name} (Owner: {self.user.username})"


class Collection(models.Model):
    # Organizes content within a library into distinct categories or themes.
    library = models.ForeignKey(Library, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.name} in {self.library.name}"


class Content(models.Model):
    # Holds individual pieces of media or information such as videos, texts, images, or audio.

    MEDIA_TYPES = [
        ('VIDEO', 'Video'),
        ('AUDIO', 'Audio'),
        ('TEXT', 'Text'),
        ('IMAGE', 'Image')
    ]
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, null=True, blank=True)
    title = models.CharField(max_length=255)
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    created_for = models.CharField(max_length=20, choices=[('KNOWLEDGE_PATH', 'Knowledge Path'), ('USER_WALL', 'User Wall'), ('TEACHER_RESOURCE', 'Teacher Resource')], default='USER_WALL')
    media_type = models.CharField(max_length=5, choices=MEDIA_TYPES, default='TEXT')
    activity_requirement = models.ForeignKey('ActivityRequirement', on_delete=models.SET_NULL, null=True, blank=True, related_name='required_contents')
    is_visible = models.BooleanField(default=False)  # Whether the content is visible to others
    rating = models.IntegerField(blank=True, null=True, choices=[(i, str(i)) for i in range(1, 6)])  # Content rating by teachers or peers
    feedback = models.TextField(blank=True, null=True)  # Optional feedback from teachers or peers
    topics = models.ManyToManyField('Topic', related_name='contents')  # Links contents to multiple topics

    def __str__(self):
        return f"{self.title} by {self.author.username if self.author else 'Unknown Author'}"


class FileDetails(models.Model):
    # Stores additional file-specific details like URL, size, and type for content items.

    content = models.OneToOneField(Content, on_delete=models.CASCADE)
    file = models.FileField(upload_to='files/')
    url = models.URLField(max_length=200, blank=True, null=True)
    extension = models.CharField(max_length=10, blank=True)
    file_size = models.PositiveIntegerField(blank=True, null=True)
    extracted_text = models.TextField(blank=True, null=True)
    text_length = models.PositiveIntegerField(blank=True, null=True)
    text_hash = models.CharField(max_length=64, blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"File for {self.content.title} ({self.file.name})"


class BlockchainInteraction(models.Model):
    # Records transaction details when content interactions are recorded on a blockchain.

    content = models.OneToOneField(Content, on_delete=models.CASCADE)
    transaction_receipt = models.JSONField(blank=True, null=True)

    def __str__(self):
        return f"Blockchain Interaction for {self.content.title}"


class KnowledgePath(models.Model):
    # Represents a structured sequence of learning nodes designed for educational purposes.

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_paths')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    votes = models.IntegerField(default=0)

    def __str__(self):
        return self.title

    def update_vote_count(self, new_votes=1):
        """ Update the vote count by a specified number of new votes. """
        # Using F() expression to avoid race conditions
        self.votes = models.F('votes') + new_votes
        self.save()
        print(self.votes, new_votes)
        self.refresh_from_db()  # Refresh to get the updated vote_count after F() expression


class Node(models.Model):
    # Acts as a single step or element in a KnowledgePath, holding specific content and its type.

    MEDIA_TYPES = [
        ('VIDEO', 'Video'),
        ('AUDIO', 'Audio'),
        ('TEXT', 'Text'),
        ('IMAGE', 'Image')
    ]
    knowledge_path = models.ForeignKey(KnowledgePath, related_name='nodes', on_delete=models.CASCADE)
    media_type = models.CharField(max_length=5, choices=MEDIA_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    content = models.ForeignKey(Content, related_name='nodes', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.get_media_type_display()})"


class NodeOrder(models.Model):
    # Determines the sequential order of nodes within a KnowledgePath.

    knowledge_path = models.ForeignKey(KnowledgePath, related_name='node_orders', on_delete=models.CASCADE)
    node = models.ForeignKey(Node, on_delete=models.CASCADE)
    order = models.PositiveIntegerField()

    class Meta:
        ordering = ['order']
        unique_together = ('knowledge_path', 'order')  # Ensures order uniqueness within a knowledge path

    def __str__(self):
        return f"{self.knowledge_path.title} - Order {self.order}"


class ActivityRequirement(models.Model):
    # Defines additional activities or requirements needed to progress through or complete sections of a KnowledgePath.

    ACTIVITY_TYPES = [
        ('QUIZ', 'Quiz'),
        ('VIDEO_CONSULTATION', 'Video Consultation'),
        ('CONTENT_CREATION', 'Content Creation')
    ]
    knowledge_path = models.ForeignKey(KnowledgePath, related_name='requirements', on_delete=models.CASCADE)
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    description = models.TextField()

    def __str__(self):
        return f"{self.get_activity_type_display()} for {self.knowledge_path.title}"


class NodeActivityRequirement(models.Model):
    # Links specific nodes in a KnowledgePath with required activities, ensuring prerequisites are completed.

    preceding_node = models.ForeignKey(Node, related_name='following_activities', on_delete=models.CASCADE)
    following_node = models.ForeignKey(Node, related_name='preceding_activities', on_delete=models.CASCADE, null=True, blank=True)
    activity_requirement = models.ForeignKey(ActivityRequirement, on_delete=models.CASCADE)
    is_mandatory = models.BooleanField(default=True)

    class Meta:
        unique_together = ('preceding_node', 'following_node', 'activity_requirement')
        # Ensure that if following_node is null, the combination of preceding_node and activity_requirement is unique

    def __str__(self):
        if self.following_node:
            return f"Complete {self.activity_requirement} to move from {self.preceding_node.title} to {self.following_node.title}"
        else:
            return f"Complete {self.activity_requirement} to finish {self.preceding_node.title}"


class Topic(models.Model):
    # Represents a subject under which multiple contents and discussions can be grouped.

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    creator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_topics')
    moderators = models.ManyToManyField(User, related_name='moderated_topics')
    related_topics = models.ManyToManyField('self', blank=True, related_name='related_to', symmetrical=False)

    def __str__(self):
        return self.title

    def is_moderator_or_creator(self, user):
        return user == self.creator or user in self.moderators.all()


class ModerationLog(models.Model):
    # Tracks moderation actions like deletions or reports performed by moderators on content.

    ACTION_CHOICES = [
        ('DELETE', 'Delete'),
        ('REPORT', 'Report')
    ]
    moderator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='moderation_actions')
    content = models.ForeignKey(Content, on_delete=models.CASCADE, related_name='moderation_logs')
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} by {self.moderator.username} on {self.content.title} at {self.created_at}"

