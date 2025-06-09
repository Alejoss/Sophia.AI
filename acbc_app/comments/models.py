import bleach
from django.db import models
from django.db.models.signals import pre_save
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.apps import apps
from django.conf import settings

from content.models import Topic
from certificates.models import Certificate
from comments.managers import CommentManager
from knowledge_paths.models import KnowledgePath
from content.models import Topic


class Comment(models.Model):    
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_edited = models.BooleanField(default=False)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    topic = models.ForeignKey(Topic, null=True, blank=True, on_delete=models.CASCADE)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')
    is_active = models.BooleanField(default=True)

    objects = CommentManager()

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['parent']),
        ]

    def __str__(self):
        return f"Comment by {self.author.username} on {self.created_at}"

    @property
    def author_is_certified(self):
        if isinstance(self.content_object, KnowledgePath):
            # Check for a certificate for the specific KnowledgePath
            return Certificate.objects.filter(user=self.author, knowledge_path=self.content_object).exists()
        return False

    @property
    def vote_count(self):
        VoteCount = apps.get_model('votes', 'VoteCount')
        vote_count = VoteCount.objects.filter(
            content_type=ContentType.objects.get_for_model(self),
            object_id=self.id
        ).first()
        return vote_count.vote_count if vote_count else 0

    def get_user_vote(self, user):
        if not user.is_authenticated:
            return 0
        Vote = apps.get_model('votes', 'Vote')
        vote = Vote.objects.filter(
            content_type=ContentType.objects.get_for_model(self),
            object_id=self.id,
            user=user
        ).first()
        return vote.value if vote else 0

    @property
    def thread_path(self):
        """Get the full path of parent comments"""
        path = []
        current = self
        while current.parent:
            path.append(current.parent.id)
            current = current.parent
        return path

    @property
    def thread_depth(self):
        """Get the depth level of the comment in the thread"""
        return len(self.thread_path)

    def get_thread_siblings(self):
        """Get comments at the same level in the thread"""
        return Comment.objects.filter(
            content_type=self.content_type,
            object_id=self.object_id,
            parent=self.parent
        ).exclude(id=self.id)

    def save(self, *args, **kwargs):
        self.body = bleach.clean(self.body)
        if self.id:  # If this is an update
            self.is_edited = True
        super().save(*args, **kwargs)