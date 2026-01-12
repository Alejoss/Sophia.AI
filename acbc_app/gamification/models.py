from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class BadgeCategory(models.TextChoices):
    LEARNING = 'LEARNING', 'Learning'
    CONTRIBUTION = 'CONTRIBUTION', 'Contribution'
    RECOGNITION = 'RECOGNITION', 'Recognition'
    FOUNDER = 'FOUNDER', 'Founder'


class Badge(models.Model):
    """
    Defines badges available in the gamification system.
    Each badge represents a meaningful achievement or milestone.
    """
    code = models.CharField(max_length=100, unique=True, help_text="Unique code identifier for the badge")
    name = models.CharField(max_length=200, help_text="Display name of the badge")
    description = models.TextField(help_text="Description of what this badge represents")
    icon = models.ImageField(upload_to='badge_icons/', null=True, blank=True, help_text="Icon/image for the badge")
    category = models.CharField(max_length=20, choices=BadgeCategory.choices, default=BadgeCategory.LEARNING)
    points_value = models.IntegerField(default=10, help_text="Points awarded when this badge is earned")
    is_active = models.BooleanField(default=True, help_text="Whether this badge is currently active")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['category', 'points_value', 'name']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class UserBadge(models.Model):
    """
    Tracks badges earned by users.
    Stores the relationship between a user and a badge they've earned.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_badges')
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE, related_name='user_badges')
    earned_at = models.DateTimeField(auto_now_add=True)
    points_earned = models.IntegerField(help_text="Points awarded when this badge was earned")
    context_data = models.JSONField(default=dict, blank=True, help_text="Additional context data (e.g., which course was completed)")

    class Meta:
        unique_together = ('user', 'badge')
        ordering = ['-earned_at']
        indexes = [
            models.Index(fields=['user', 'badge']),
            models.Index(fields=['earned_at']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.badge.name}"