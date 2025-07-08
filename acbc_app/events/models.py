from datetime import datetime
from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils import timezone

from profiles.models import AcceptedCrypto, Profile



def upload_event_picture(instance, filename):
    return "event_pictures/" + instance.title + "_" + datetime.today().strftime('%h-%d-%y') + ".jpeg"
    # TODO utilizar django timezone module


class Event(models.Model):    
    """
    It can be a Recorded Course, a Live Course, a Conference, etc.
    """
    EVENT_TYPES = (("LIVE_COURSE", "Live Course"),
                   ("LIVE_CERTIFICATION", "Live Certification"),
                   ("LIVE_MASTER_CLASS", "Live Master Class"))
    
    PLATFORM_CHOICES = [
        ('google_meet', 'Google Meet'),
        ('jitsi', 'Jitsi'),
        ('microsoft_teams', 'Microsoft Teams'),
        ('telegram', 'Telegram'),
        ('tox', 'Tox'),
        ('twitch', 'Twitch'),
        ('zoom', 'Zoom'),
        ('other', 'Other'),
    ]
    
    event_type = models.CharField(max_length=50, choices=EVENT_TYPES, blank=True)
    image = models.ImageField(upload_to=upload_event_picture, null=True, blank=True)

    owner = models.ForeignKey(User, null=True, on_delete=models.CASCADE)
    title = models.CharField(max_length=150, blank=True)
    description = models.CharField(max_length=10000, blank=True)
    platform = models.CharField(max_length=150, null=True, blank=True)
    other_platform = models.CharField(max_length=150, blank=True)
    reference_price = models.FloatField(default=0, blank=True, null=True)

    date_created = models.DateTimeField(auto_now_add=True)
    date_start = models.DateTimeField(null=True, blank=True)
    date_end = models.DateTimeField(null=True, blank=True)
    date_recorded = models.DateTimeField(null=True, blank=True)
    schedule_description = models.CharField(max_length=1000, blank=True)
    deleted = models.BooleanField(default=False, blank=True)

    class Meta:
        ordering = ['-date_created']

    def clean(self):
        """Custom validation"""
        if self.platform == 'other' and not self.other_platform:
            raise ValidationError("Other platform name is required when platform is 'Other'")
        
        if self.date_end and self.date_start and self.date_end <= self.date_start:
            raise ValidationError("End date must be after start date")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        owner_name = self.owner.username if self.owner else "Unknown"
        return f"{self.title} - {owner_name}"


class EventRegistration(models.Model):
    """
    Tracks user registrations for events
    """
    REGISTRATION_STATUS_CHOICES = [
        ('REGISTERED', 'Registered'),
        ('CANCELLED', 'Cancelled')
    ]
    
    PAYMENT_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PAID', 'Paid'),
        ('REFUNDED', 'Refunded')
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='event_registrations')
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='registrations')
    registered_at = models.DateTimeField(auto_now_add=True)
    registration_status = models.CharField(max_length=20, choices=REGISTRATION_STATUS_CHOICES, default='REGISTERED')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='PENDING')
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = ('user', 'event')
        ordering = ['-registered_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.event.title} ({self.registration_status})"
    
    def clean(self):
        """Custom validation"""
        # Prevent event creator from registering for their own event
        if self.user == self.event.owner:
            raise ValidationError("Event creators cannot register for their own events")
        
        # Check if event is in the past
        if self.event.date_start and self.event.date_start < timezone.now():
            raise ValidationError("Cannot register for events that have already started")
    
    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)
    