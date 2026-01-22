from datetime import datetime

from django.core.validators import URLValidator, FileExtensionValidator
from django.core.exceptions import ValidationError
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

from knowledge_paths.models import Node, KnowledgePath
from quizzes.models import Quiz


def upload_profile_picture(instance, filename):
    # TODO use django utils timezone
    return "profile_pictures/" + instance.user.username + "_" + datetime.today().strftime('%h-%d-%y') + ".jpeg"


def upload_crypto_thumbnail(instance, filename):
    # Generate a unique filename for cryptocurrency thumbnails
    # Use the cryptocurrency code and current timestamp
    import os
    from django.utils import timezone
    
    # Get file extension
    ext = filename.split('.')[-1]
    # Create filename with crypto code and timestamp
    filename = f"crypto_thumbnails/{instance.code.lower()}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.{ext}"
    return filename


def validate_image_or_svg_file(value):
    """Custom validator to accept both image files and SVG files"""
    import os
    from django.core.exceptions import ValidationError
    
    # Get file extension
    ext = os.path.splitext(value.name)[1].lower()
    
    # Allowed extensions
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
    
    if ext not in allowed_extensions:
        raise ValidationError(
            f'File type not supported. Allowed types: {", ".join(allowed_extensions)}'
        )


class Profile(models.Model):
    # Represents user profiles with personal details, preferences, and a custom uploaded profile picture.

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    interests = models.CharField(max_length=250, blank=True)
    profile_description = models.TextField(max_length=2500, blank=True)
    external_url = models.URLField(max_length=500, blank=True)
    timezone = models.CharField(max_length=30, blank=True)
    is_teacher = models.BooleanField(default=False)
    profile_picture = models.ImageField(upload_to=upload_profile_picture, null=True, blank=True)
    total_points = models.IntegerField(default=0, help_text="Total gamification points earned by the user")
    featured_badge = models.ForeignKey(
        'gamification.UserBadge',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='featured_profiles',
        help_text="Badge destacado que se muestra junto al nombre de usuario"
    )

    def __str__(self):
        return self.user.username

    def add_points(self, points):
        """Safely add points to the user's total."""
        from django.db.models import F
        Profile.objects.filter(id=self.id).update(total_points=F('total_points') + points)
        self.refresh_from_db()
    
    def can_set_featured_badge(self, user_badge):
        """Check if user can set this badge as featured."""
        return user_badge.user == self.user


class CryptoCurrency(models.Model):
    # Defines a cryptocurrency by name and code, ensuring each currency name is unique within the system.

    name = models.CharField(max_length=50, blank=True, unique=True)
    code = models.CharField(max_length=10, blank=True)
    thumbnail = models.FileField(
        upload_to=upload_crypto_thumbnail, 
        null=True, 
        blank=True, 
        help_text="Cryptocurrency logo/thumbnail (supports JPG, PNG, GIF, SVG)",
        validators=[validate_image_or_svg_file]
    )

    def __str__(self):
        return self.name


class AcceptedCrypto(models.Model):
    # Tracks cryptocurrency addresses accepted by users for transactions, allowing soft deletion.

    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True)
    crypto = models.ForeignKey(CryptoCurrency, on_delete=models.CASCADE, null=True)
    address = models.CharField(max_length=250, blank=True)
    deleted = models.BooleanField(default=False)

    def __str__(self):
        return self.user.username + " - " + self.crypto.name


class ContactMethod(models.Model):
    # Stores user-specific contact methods with optional URLs, which are validated and can be soft deleted.

    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True)
    name = models.CharField(max_length=50, blank=True)
    description = models.CharField(max_length=250, blank=True)
    url_link = models.CharField(max_length=250, blank=True)
    deleted = models.BooleanField(default=False)

    def has_contact_url(self):
        try:
            x = URLValidator()
            x(self.url_link)
            return True
        except ValidationError:
            return False

    def __str__(self):
        return self.name + " " + self.user.username


class UserNodeCompletion(models.Model):
    # Tracks the completion status of each node for a user within a knowledge path.

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    knowledge_path = models.ForeignKey(KnowledgePath, on_delete=models.CASCADE)
    node = models.ForeignKey(Node, on_delete=models.CASCADE)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'knowledge_path', 'node')

    def __str__(self):
        status = 'Completed' if self.is_completed else 'Pending'
        return f"{self.user.username} - {self.node.title} ({status})"


class Suggestion(models.Model):
    # Stores user suggestions/feedback about the platform.

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='suggestions')
    message = models.TextField(help_text="Sugerencia o feedback del usuario")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Sugerencia de {self.user.username} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"