import bleach

from django.db import models
from django.db.models.signals import pre_save
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

from content.models import Topic
from certificates.models import Certificate
from comments.managers import CommentManager
from knowledge_paths.models import KnowledgePath


class Comment(models.Model):
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='comments')
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    votes = models.IntegerField(default=0)
    topic = models.ForeignKey(Topic, on_delete=models.SET_NULL, null=True, blank=True, related_name='comments')
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    is_active = models.BooleanField(default=True)

    objects = CommentManager()

    def __str__(self):
        return f"Comment by {self.author.username} on {self.created_at}"

    @property
    def author_is_certified(self):
        if isinstance(self.content_object, KnowledgePath):
            # Check for a certificate for the specific KnowledgePath
            return Certificate.objects.filter(user=self.author, knowledge_path=self.content_object).exists()
        return False

    def update_vote_count(self, new_votes=1):
        """ Update the vote count by a specified number of new votes. """
        # Using F() expression to avoid race conditions
        self.votes = models.F('votes') + new_votes
        self.save()
        self.refresh_from_db()  # Refresh to get the updated vote_count after F() expression


def sanitize_comment_body(sender, instance, *args, **kwargs):
    instance.body = bleach.clean(instance.body)


pre_save.connect(sanitize_comment_body, sender=Comment)