from django.db import models
from django.contrib.auth.models import User
from knowledge_paths.models import KnowledgePath
from django.core.validators import MinValueValidator
import uuid
from datetime import datetime, timedelta
from django.utils import timezone
from django.core.exceptions import ValidationError


class CertificateTemplate(models.Model):
    # Defines templates for certificates, including the title and detailed description, used in the generation of actual certificates.
    title = models.CharField(max_length=255)
    description = models.TextField()
    template_file = models.FileField(upload_to='certificate_templates/', null=True, blank=True)
    version = models.CharField(max_length=50, default='1.0')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    note = models.TextField(blank=True, null=True, help_text="Optional note from the approver")

    def __str__(self):
        return f"{self.title} (v{self.version})"


class Certificate(models.Model):
    # Represents an issued certificate for completing a KnowledgePath or attending an Event, linked to specific templates.

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
    event = models.ForeignKey(
        'events.Event',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Event for which this certificate was issued"
    )
    event_registration = models.ForeignKey(
        'events.EventRegistration',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Event registration associated with this certificate"
    )
    template = models.ForeignKey(CertificateTemplate, on_delete=models.CASCADE, null=True, blank=True)
    issued_on = models.DateTimeField(auto_now_add=True)
    issued_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='issued_certificates',
        help_text="User who issued the certificate (usually event creator or knowledge path author)"
    )
    blockchain_hash = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Blockchain transaction hash"
    )
    certificate_file = models.FileField(
        upload_to='certificates/',
        null=True,
        blank=True,
        help_text="Generated certificate file (PDF, etc.)"
    )
    additional_notes = models.TextField(
        blank=True,
        help_text="Additional notes from the certificate issuer"
    )
    data = models.JSONField(
        default=dict,
        help_text="Additional certificate-specific data"
    )

    class Meta:
        unique_together = [['user', 'knowledge_path'], ['user', 'event']]

    def clean(self):
        """Ensure either knowledge_path or event is set, but not both"""
        if not self.knowledge_path and not self.event:
            raise ValidationError("Either knowledge_path or event must be specified")
        if self.knowledge_path and self.event:
            raise ValidationError("Cannot specify both knowledge_path and event")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        if self.knowledge_path:
            return f"Certificate {self.certificate_id} for {self.user.username} - {self.knowledge_path.title}"
        elif self.event:
            return f"Certificate {self.certificate_id} for {self.user.username} - {self.event.title}"
        return f"Certificate {self.certificate_id} for {self.user.username}"


class CertificateRequest(models.Model):
    # Tracks user requests for certificates based on completed KnowledgePaths or events, managing the request's approval status and related details.
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled')
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
    event = models.ForeignKey(
        'events.Event',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Event for which certificate is requested"
    )
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='PENDING'
    )

    request_date = models.DateTimeField(auto_now_add=True)
    response_date = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(
        blank=True,
        null=True,
        help_text="Reason for rejection if status is REJECTED"
    )
    notes = models.JSONField(
        default=dict,
        help_text="Additional request-specific data"
    )

    class Meta:
        unique_together = [['requester', 'knowledge_path'], ['requester', 'event']]

    def clean(self):
        """Ensure either knowledge_path or event is set, but not both"""
        print(f"DEBUG: CertificateRequest.clean() called")
        print(f"DEBUG: knowledge_path: {self.knowledge_path}")
        print(f"DEBUG: event: {self.event}")
        if not self.knowledge_path and not self.event:
            print(f"DEBUG: ValidationError - neither knowledge_path nor event specified")
            raise ValidationError("Either knowledge_path or event must be specified")
        if self.knowledge_path and self.event:
            print(f"DEBUG: ValidationError - both knowledge_path and event specified")
            raise ValidationError("Cannot specify both knowledge_path and event")
        print(f"DEBUG: CertificateRequest.clean() passed validation")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        if self.knowledge_path:
            return f"{self.requester.username}'s request for {self.knowledge_path.title}"
        elif self.event:
            return f"{self.requester.username}'s request for {self.event.title}"
        return f"{self.requester.username}'s certificate request"

    def approve(self, note=''):
        if self.status not in ['PENDING', 'REJECTED']:
            raise ValueError('Can only approve pending or rejected requests')
        
        self.status = 'APPROVED'
        self.response_date = timezone.now()
        self.save()
        
        # Create certificate template with note
        if self.knowledge_path:
            template = CertificateTemplate.objects.create(
                title=f"Certificate for {self.knowledge_path.title}",
                description=f"Certificate issued for completing {self.knowledge_path.title}",
                note=note
            )
            
            # Create certificate with template
            Certificate.objects.create(
                user=self.requester,
                knowledge_path=self.knowledge_path,
                template=template
            )
        elif self.event:
            template = CertificateTemplate.objects.create(
                title=f"Certificate for {self.event.title}",
                description=f"Certificate issued for attending {self.event.title}",
                note=note
            )
            
            # Create certificate with template
            Certificate.objects.create(
                user=self.requester,
                event=self.event,
                template=template
            )

    def reject(self, reason='', note=''):
        if self.status != 'PENDING':
            raise ValueError('Can only reject pending requests')
        
        self.status = 'REJECTED'
        self.response_date = timezone.now()
        self.rejection_reason = reason
        self.save()

    def cancel(self):
        if self.status != 'PENDING':
            raise ValueError('Can only cancel pending requests')
        
        self.status = 'CANCELLED'
        self.response_date = timezone.now()
        self.save()
