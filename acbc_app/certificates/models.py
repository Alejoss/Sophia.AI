from django.db import models
from django.contrib.auth.models import User
from knowledge_paths.models import KnowledgePath
from django.core.validators import MinValueValidator
import uuid
from datetime import datetime, timedelta
from django.utils import timezone


class CertificateTemplate(models.Model):
    # Defines templates for certificates, including the title and detailed description, used in the generation of actual certificates.
    title = models.CharField(max_length=255)
    description = models.TextField()
    template_file = models.FileField(upload_to='certificate_templates/', null=True, blank=True)
    version = models.CharField(max_length=50, default='1.0')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} (v{self.version})"


class Certificate(models.Model):
    # Represents an issued certificate for completing a KnowledgePath, with potential future extension to include events, linked to specific templates.

    certificate_id = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    knowledge_path = models.ForeignKey(
        'knowledge_paths.KnowledgePath',
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    template = models.ForeignKey(CertificateTemplate, on_delete=models.CASCADE)
    issued_on = models.DateTimeField(auto_now_add=True)
    blockchain_hash = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Blockchain transaction hash"
    )
    data = models.JSONField(
        default=dict,
        help_text="Additional certificate-specific data"
    )

    def __str__(self):
        return f"Certificate {self.certificate_id} for {self.user.username}"



class CertificateRequest(models.Model):
    # Tracks user requests for certificates based on completed KnowledgePaths or events, managing the request's approval status and related details.
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected')
    ]

    requester = models.ForeignKey(
        User,
        related_name='certificate_requests',
        on_delete=models.CASCADE
    )

    knowledge_path = models.ForeignKey(
        'knowledge_paths.KnowledgePath',
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='PENDING'
    )

    request_date = models.DateTimeField(auto_now_add=True)
    response_date = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User,
        related_name='reviewed_certificate_requests',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    rejection_reason = models.TextField(
        blank=True,
        null=True,
        help_text="Reason for rejection if status is REJECTED"
    )
    notes = models.JSONField(
        default=dict,
        help_text="Additional request-specific data"
    )

    def __str__(self):
        return f"{self.requester.username}'s request for {self.knowledge_path.title if self.knowledge_path else 'an event'}"

    def approve(self, reviewer):
        self.status = 'APPROVED'
        self.reviewed_by = reviewer
        self.response_date = timezone.now()
        self.save()

    def reject(self, reviewer, reason):
        self.status = 'REJECTED'
        self.reviewed_by = reviewer
        self.rejection_reason = reason
        self.response_date = timezone.now()
        self.save()
