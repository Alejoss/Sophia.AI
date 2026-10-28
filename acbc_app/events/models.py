from datetime import datetime
from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils import timezone

from events.scheduling import event_range_is_invalid
from profiles.models import AcceptedCrypto, Profile



def upload_event_picture(instance, filename):
    return "event_pictures/" + instance.title + "_" + datetime.today().strftime('%h-%d-%y') + ".jpeg"
    # TODO utilizar django timezone module


def upload_featured_event_banner(instance, filename):
    """Wide ad creative. Kept apart from the event card image."""
    extension = 'jpg'
    if '.' in filename:
        extension = filename.rsplit('.', 1)[-1].lower()
    if extension not in {'jpg', 'jpeg', 'png', 'webp', 'gif'}:
        extension = 'jpg'
    stamp = timezone.now().strftime('%Y%m%d%H%M%S')
    return f'featured_events/event_{instance.event_id}_{stamp}.{extension}'


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
    date_start_has_time = models.BooleanField(
        default=True,
        help_text="False when date_start is a calendar day with no clock time.",
    )
    date_end = models.DateTimeField(null=True, blank=True)
    date_end_has_time = models.BooleanField(
        default=True,
        help_text="False when date_end is a calendar day with no clock time.",
    )
    date_recorded = models.DateTimeField(null=True, blank=True)
    schedule_description = models.CharField(max_length=1000, blank=True)
    is_visible = models.BooleanField(
        default=False,
        blank=True,
        help_text="Whether this event is visible to other users",
    )
    deleted = models.BooleanField(default=False, blank=True)

    class Meta:
        ordering = ['-date_created']

    def clean(self):
        """Custom validation"""
        if self.platform == 'other' and not self.other_platform:
            raise ValidationError("Other platform name is required when platform is 'Other'")
        
        if event_range_is_invalid(
            self.date_start,
            self.date_end,
            self.date_start_has_time,
            self.date_end_has_time,
        ):
            raise ValidationError("End date must be after start date")

    def has_started(self, now=None):
        """Whether registration and 'already started' checks should close.

        A date with no clock time stays open through that UTC calendar day.
        """
        if not self.date_start:
            return False
        now = now or timezone.now()
        if not self.date_start_has_time:
            return self.date_start.date() < now.date()
        return self.date_start < now

    def has_ended(self, now=None):
        """Whether the event is over.

        A date with no clock time is still in progress on that UTC calendar day.
        """
        if not self.date_end:
            return False
        now = now or timezone.now()
        if not self.date_end_has_time:
            return self.date_end.date() < now.date()
        return self.date_end <= now

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        owner_name = self.owner.username if self.owner else "Unknown"
        return f"{self.title} - {owner_name}"


class FeaturedEvent(models.Model):
    """Site banner that advertises one event under the main navigation.

    The wide image belongs to this placement. The event keeps its own card image.
    Only one placement stays active: saving an active banner clears the others.
    """

    event = models.OneToOneField(
        Event,
        on_delete=models.CASCADE,
        related_name='feature_placement',
    )
    image = models.ImageField(
        upload_to=upload_featured_event_banner,
        help_text='Wide banner, about 1600×280 pixels. Shown under the nav on Biblioteca, Caminos, and Temas.',
    )
    is_active = models.BooleanField(
        default=True,
        help_text='The active banner is the one visitors see. Turning this on hides any other banner.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.event.title} banner'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_active:
            FeaturedEvent.objects.filter(is_active=True).exclude(pk=self.pk).update(is_active=False)

    @classmethod
    def live(cls):
        """The banner visitors should see, or None."""
        placement = (
            cls.objects
            .select_related('event')
            .filter(is_active=True, event__deleted=False, event__is_visible=True)
            .order_by('-updated_at')
            .first()
        )
        if placement is None or placement.event.has_ended():
            return None
        return placement


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
        
        if self.event.has_started():
            raise ValidationError("Cannot register for events that have already started")
    
    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)
    