from django.db import models
from django.contrib.auth.models import User
from knowledge_paths.models import KnowledgePath  # Changed from content to knowledge_paths
# from events.models import Event  # You might add this later


class Certificate(models.Model):
    # Represents an issued certificate for completing a KnowledgePath, with potential future extension to include events, linked to specific templates.
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    knowledge_path = models.ForeignKey('knowledge_paths.KnowledgePath', on_delete=models.CASCADE, null=True, blank=True)
    # event = models.ForeignKey(Event, on_delete=models.CASCADE, null=True, blank=True)  # Uncomment in the future
    template = models.ForeignKey('CertificateTemplate', on_delete=models.CASCADE)
    issued_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.knowledge_path:
            return f"Certificate for {self.user.username} - {self.knowledge_path.title}"
        # elif self.event:
        #     return f"Certificate for {self.user.username} - {self.event.title}"
        else:
            return f"Certificate for {self.user.username}"


class CertificateRequest(models.Model):
    # Tracks user requests for certificates based on completed KnowledgePaths or events, managing the request's approval status and related details.
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected')
    ]

    requester = models.ForeignKey(User, related_name='certificate_requests', on_delete=models.CASCADE)
    knowledge_path = models.ForeignKey('knowledge_paths.KnowledgePath', on_delete=models.CASCADE, null=True, blank=True)
    # event = models.ForeignKey(Event, on_delete=models.CASCADE, null=True, blank=True)  # To be used later
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    request_date = models.DateTimeField(auto_now_add=True)
    response_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.requester.username}'s request for {self.knowledge_path.title if self.knowledge_path else 'an event'}"


class CertificateTemplate(models.Model):
    # Defines templates for certificates, including the title and detailed description, used in the generation of actual certificates.
    title = models.CharField(max_length=255)
    description = models.TextField()

    def __str__(self):
        return self.title
