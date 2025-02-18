from datetime import datetime

from django.core.validators import URLValidator
from django.core.exceptions import ValidationError
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

from knowledge_paths.models import ActivityRequirement, Node


def upload_profile_picture(instance, filename):
    # TODO use django utils timezone
    return "profile_pictures/" + instance.user.username + "_" + datetime.today().strftime('%h-%d-%y') + ".jpeg"


class Profile(models.Model):
    # Represents user profiles with personal details, preferences, and a custom uploaded profile picture.

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    interests = models.CharField(max_length=250, blank=True)
    profile_description = models.TextField(max_length=2500, blank=True)
    timezone = models.CharField(max_length=30, blank=True)
    is_teacher = models.BooleanField(default=False)
    profile_picture = models.ImageField(upload_to=upload_profile_picture, null=True, blank=True)

    def __str__(self):
        return self.user.username


class CryptoCurrency(models.Model):
    # Defines a cryptocurrency by name and code, ensuring each currency name is unique within the system.

    name = models.CharField(max_length=50, blank=True, unique=True)
    code = models.CharField(max_length=10, blank=True)

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


class UserProgressKnowledgePath(models.Model):
    # Records progress of users through nodes in a KnowledgePath, ensuring uniqueness for each user-node combination.

    user = models.ForeignKey(User, on_delete=models.CASCADE)    
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    current_node = models.ForeignKey(Node, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        status = 'Completed' if self.is_completed else 'Not Completed'
        return f"{self.user.username} - ({status})"


class UserActivityStatus(models.Model):
    # Keeps track of user completions for specific activities within a knowledge path, recording completion status and time.
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    activity_requirement = models.ForeignKey(ActivityRequirement, on_delete=models.CASCADE)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        status = 'Completed' if self.is_completed else 'Pending'
        return f"{self.user.username} - {self.activity_requirement} ({status})"
