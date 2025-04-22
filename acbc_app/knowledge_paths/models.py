from django.db import models
from django.contrib.auth.models import User
from content.models import Content
from django.apps import apps
from django.contrib.contenttypes.models import ContentType

from content.models import ContentProfile


def upload_knowledge_path_image(instance, filename):
    # Generate path: knowledge_path_images/path_<id>_<filename>
    return f"knowledge_path_images/path_{instance.id}_{filename}"

class KnowledgePath(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_paths')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    image = models.ImageField(
        upload_to=upload_knowledge_path_image, 
        null=True, 
        blank=True,
        help_text="Cover image for the knowledge path"
    )

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

    def __str__(self):
        return self.title

    def update_vote_count(self, new_votes=1):
        self.votes = models.F('votes') + new_votes
        self.save()
        self.refresh_from_db()

    def delete(self, *args, **kwargs):
        # Delete the image file when the knowledge path is deleted
        if self.image:
            self.image.delete()
        super().delete(*args, **kwargs)

class Node(models.Model):
    MEDIA_TYPES = [
        ('VIDEO', 'Video'),
        ('AUDIO', 'Audio'),
        ('TEXT', 'Text'),
        ('IMAGE', 'Image')
    ]
    knowledge_path = models.ForeignKey(KnowledgePath, on_delete=models.CASCADE, related_name='nodes')
    content_profile = models.ForeignKey(ContentProfile, on_delete=models.CASCADE, null=True, blank=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    media_type = models.CharField(max_length=20, choices=MEDIA_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']
        unique_together = [['knowledge_path', 'order']]

    def save(self, *args, **kwargs):
        if not self.order:
            last_order = Node.objects.filter(knowledge_path=self.knowledge_path).aggregate(
                models.Max('order'))['order__max']
            self.order = (last_order or 0) + 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} ({self.get_media_type_display()})"

    def get_preceding_node(self):
        """
        Retrieve the preceding node in the knowledge path based on the order.
        
        Returns:
            Node: The preceding node if it exists, otherwise None.
        """
        return Node.objects.filter(
            knowledge_path=self.knowledge_path,
            order__lt=self.order
        ).order_by('-order').first()

    def get_next_node(self):
        """Get the next node in the knowledge path based on order"""
        return Node.objects.filter(
            knowledge_path=self.knowledge_path,
            order__gt=self.order
        ).order_by('order').first()
