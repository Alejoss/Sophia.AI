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
    """
    Core content model representing the immutable aspects of the content.
    This is the 'source of truth' for the actual content.
    """
    MEDIA_TYPES = [
        ('VIDEO', 'Video'),
        ('AUDIO', 'Audio'),
        ('TEXT', 'Text'),
        ('IMAGE', 'Image')
    ]
    
    # Original upload information
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    media_type = models.CharField(max_length=5, choices=MEDIA_TYPES, default='TEXT')
    original_title = models.CharField(max_length=255, blank=True, null=True)  # The original title when first uploaded
    original_author = models.CharField(max_length=255, blank=True, null=True)  # Original creator/author
    
    # Content classification
    topics = models.ManyToManyField('Topic', related_name='contents', blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Content: {self.original_title}"


class ContentProfile(models.Model):
    """
    Represents a user's personalized view/version of a content.
    Multiple users can have different profiles for the same content.
    """
    content = models.ForeignKey(Content, on_delete=models.CASCADE, related_name='profiles')
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    collection = models.ForeignKey('Collection', on_delete=models.SET_NULL, null=True, blank=True)
    
    # User's personalized metadata
    title = models.CharField(max_length=255, blank=True, null=True)  # User's custom title
    author = models.CharField(max_length=255, blank=True, null=True)  # User's attribution
    personal_note = models.TextField(blank=True, null=True)
    is_visible = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['content', 'user']  # Each user can have only one profile per content

    def __str__(self):
        return f"{self.user.username}'s view of {self.title or self.content.original_title}"

    @property
    def display_title(self):
        """Returns the custom title if set, otherwise falls back to original"""
        return self.title or self.content.original_title

    @property
    def display_author(self):
        """Returns the custom author if set, otherwise falls back to original"""
        return self.author or self.content.original_author


class FileDetails(models.Model):
    """Handles file storage and content analysis"""
    content = models.OneToOneField(Content, on_delete=models.CASCADE, related_name='file_details')
    file = models.FileField(upload_to='files/')
    file_size = models.PositiveIntegerField(blank=True, null=True)
    
    # Text analysis (for text-based content)
    extracted_text = models.TextField(blank=True, null=True)
    text_length = models.PositiveIntegerField(blank=True, null=True)
    text_hash = models.CharField(max_length=64, blank=True, null=True)
    
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"File for {self.content.original_title}"


class BlockchainInteraction(models.Model):
    # Records transaction details when content interactions are recorded on a blockchain.

    content = models.OneToOneField(Content, on_delete=models.CASCADE)
    transaction_receipt = models.JSONField(blank=True, null=True)

    def __str__(self):
        return f"Blockchain Interaction for {self.content.title}"


def topic_image_path(instance, filename):
    # Get the file extension
    ext = filename.split('.')[-1]
    # Create a new filename using the topic id and extension
    return f'topic_images/{instance.id}/topic_image.{ext}'

class Topic(models.Model):
    # Represents a subject under which multiple contents and discussions can be grouped.

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    creator = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    topic_image = models.ImageField(
        upload_to=topic_image_path,
        null=True,
        blank=True,
        max_length=255
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
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

