from django.db import models
from django.contrib.auth.models import User
from content.models import Content



def upload_knowledge_path_image(instance, filename):
    # Generate path: knowledge_path_images/path_<id>_<filename>
    return f"knowledge_path_images/path_{instance.id}_{filename}"

class KnowledgePath(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_paths')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    votes = models.IntegerField(default=0)
    image = models.ImageField(
        upload_to=upload_knowledge_path_image, 
        null=True, 
        blank=True,
        help_text="Cover image for the knowledge path"
    )


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
    content = models.ForeignKey(Content, on_delete=models.CASCADE)
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

class ActivityRequirement(models.Model):
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
    preceding_node = models.ForeignKey(Node, related_name='following_activities', on_delete=models.CASCADE)
    following_node = models.ForeignKey(Node, related_name='preceding_activities', on_delete=models.CASCADE, null=True, blank=True)
    activity_requirement = models.ForeignKey(ActivityRequirement, on_delete=models.CASCADE)
    is_mandatory = models.BooleanField(default=True)

    class Meta:
        unique_together = ('preceding_node', 'following_node', 'activity_requirement')

    def __str__(self):
        if self.following_node:
            return f"Complete {self.activity_requirement} to move from {self.preceding_node.title} to {self.following_node.title}"
        else:
            return f"Complete {self.activity_requirement} to finish {self.preceding_node.title}"
