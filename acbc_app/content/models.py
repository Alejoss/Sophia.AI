import os
import uuid
from django.db import models
from django.contrib.auth.models import User
from django.apps import apps
from django.contrib.contenttypes.models import ContentType


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
    url = models.URLField(max_length=2000, blank=True, null=True)  # For URL-based content
    
    # Content classification
    topics = models.ManyToManyField('Topic', related_name='contents', blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Content: {self.original_title}"

    @property
    def is_url_content(self):
        """Returns whether this content is URL-based"""
        return bool(self.url)

    def get_vote_count(self, topic=None):
        """Get the current vote count, optionally filtered by topic"""
        
        VoteCount = apps.get_model('votes', 'VoteCount')
        content_type = ContentType.objects.get_for_model(self)
        
        vote_count = VoteCount.objects.filter(
            content_type=content_type,
            object_id=self.id,
            topic=topic
        ).first()
                    
        result = vote_count.vote_count if vote_count else 0
        return result

    @property
    def vote_count(self):
        """Get the global vote count (for backward compatibility)"""
        return self.get_vote_count()

    def get_user_vote(self, user, topic=None):
        """Get the user's vote status, optionally filtered by topic"""
        Vote = apps.get_model('votes', 'Vote')
        content_type = ContentType.objects.get_for_model(self)
        vote = Vote.objects.filter(
            user=user,
            content_type=content_type,
            object_id=self.id,
            topic=topic
        ).first()
        return vote.value if vote else 0

    def can_be_modified_by(self, user):
        """
        Check if the content can be modified by the given user.
        Content can only be modified if:
        1. The user is the original uploader
        2. No other users have added this content to their libraries
        """
        if not user or not self.uploaded_by:
            return False
        
        # Check if the user is the original uploader
        if user.id != self.uploaded_by.id:
            return False
        
        # Check if there are any content profiles from other users
        other_user_profiles = self.profiles.exclude(user=user)
        return not other_user_profiles.exists()

    def get_other_user_profiles_count(self):
        """Get the count of content profiles from users other than the original uploader"""
        if not self.uploaded_by:
            return 0
        return self.profiles.exclude(user=self.uploaded_by).count()


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
    is_visible = models.BooleanField(default=True)  # Controls whether this content appears in search results
    is_producer = models.BooleanField(default=False)  # Indicates whether this user is the producer of the content
    
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


def content_file_upload_path(instance, filename):
    """S3 path: content/{media_type}/{user_id}/{uuid}_{filename}. Same structure as presign flow."""
    safe_name = os.path.basename(filename).replace(' ', '_')[:200]
    media_type = getattr(instance.content, 'media_type', 'TEXT')
    media_slug = 'document' if media_type == 'TEXT' else media_type.lower()
    user_id = instance.content.uploaded_by_id or 0
    return f"content/{media_slug}/{user_id}/{uuid.uuid4().hex}_{safe_name}"


class FileDetails(models.Model):
    """Handles file storage and content analysis"""
    content = models.OneToOneField(Content, on_delete=models.CASCADE, related_name='file_details')
    file = models.FileField(upload_to=content_file_upload_path, blank=True, null=True)  # Optional for URL content
    file_size = models.PositiveIntegerField(blank=True, null=True)
    
    # Text analysis (for text-based content)
    extracted_text = models.TextField(blank=True, null=True)
    text_length = models.PositiveIntegerField(blank=True, null=True)
    text_hash = models.CharField(max_length=64, blank=True, null=True)
    
    # Open Graph metadata (automatically extracted for URLs)
    og_description = models.TextField(blank=True, null=True)
    og_image = models.URLField(max_length=2000, blank=True, null=True)
    og_type = models.CharField(max_length=50, blank=True, null=True)
    og_site_name = models.CharField(max_length=255, blank=True, null=True)
    
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Details for {self.content.original_title}"

    @property
    def url(self):
        """Returns the content URL - either file URL or content URL"""
        if self.content.is_url_content:
            return self.content.url
        if self.file:
            return self.file.url
        return None

    @property 
    def display_description(self):
        """Returns the Open Graph description if available"""
        return self.og_description


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


class TopicModeratorInvitation(models.Model):
    # Tracks moderator invitations for topics, allowing users to accept or decline.
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('ACCEPTED', 'Accepted'),
        ('DECLINED', 'Declined'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='moderator_invitations')
    invited_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='topic_moderator_invitations')
    invited_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_topic_moderator_invitations')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    message = models.TextField(blank=True, null=True, help_text="Optional message from creator")
    
    class Meta:
        unique_together = [['topic', 'invited_user']]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Invitation to {self.invited_user.username} for topic {self.topic.title} - {self.status}"
    
    def accept(self):
        """Accept the invitation and add user as moderator"""
        if self.status != 'PENDING':
            raise ValueError("Can only accept pending invitations")
        self.topic.moderators.add(self.invited_user)
        self.status = 'ACCEPTED'
        self.save()
    
    def decline(self):
        """Decline the invitation"""
        if self.status != 'PENDING':
            raise ValueError("Can only decline pending invitations")
        self.status = 'DECLINED'
        self.save()


class ContentSuggestion(models.Model):
    """Tracks content suggestions made by users for topics. Moderators can accept or reject them."""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('ACCEPTED', 'Accepted'),
        ('REJECTED', 'Rejected'),
    ]
    
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='content_suggestions')
    content = models.ForeignKey(Content, on_delete=models.CASCADE, related_name='topic_suggestions')
    suggested_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='content_suggestions')
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_suggestions')
    
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    message = models.TextField(blank=True, null=True, help_text="Justificación o mensaje del sugeridor")
    rejection_reason = models.TextField(blank=True, null=True, help_text="Razón de rechazo del moderador")
    
    is_duplicate = models.BooleanField(default=False, help_text="Si el contenido ya está en el tema")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = [['topic', 'content', 'suggested_by']]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['topic', 'status']),
            models.Index(fields=['suggested_by', 'status']),
        ]
    
    def __str__(self):
        return f"{self.suggested_by.username} suggested {self.content.original_title} for {self.topic.title} - {self.status}"


class Publication(models.Model):    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='publications')
    content_profile = models.ForeignKey(ContentProfile, on_delete=models.CASCADE, related_name='publications', null=True, blank=True)
    text_content = models.TextField()
    status = models.CharField(max_length=20, choices=[
        ('DRAFT', 'Draft'),
        ('PUBLISHED', 'Published'),
        ('ARCHIVED', 'Archived')
    ], default='PUBLISHED')
    published_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ['-published_at']

    def __str__(self):
        if self.content_profile:
            return f"Publication: {self.content_profile.display_title} by {self.user.username}" 
        else:
            return f"Publication (by {self.user.username})"

    @property
    def vote_count(self):
        """Get the current vote count"""
        VoteCount = apps.get_model('votes', 'VoteCount')
        content_type = ContentType.objects.get_for_model(self)
        vote_count = VoteCount.objects.filter(
            content_type=content_type,
            object_id=self.id
        ).first()
        return vote_count.vote_count if vote_count else 0

    def get_user_vote(self, user):
        """Get the user's vote status"""
        Vote = apps.get_model('votes', 'Vote')
        content_type = ContentType.objects.get_for_model(self)
        vote = Vote.objects.filter(
            user=user,
            content_type=content_type,
            object_id=self.id
        ).first()
        return vote.value if vote else 0

