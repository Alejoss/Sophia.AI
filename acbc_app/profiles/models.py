from datetime import datetime

from django.core.validators import URLValidator
from django.core.exceptions import ValidationError
from django.db import models
from django.contrib.auth.models import User


def upload_profile_picture(instance, filename):
    return "profile_pictures/"+instance.user.username+"_"+datetime.today().strftime('%h-%d-%y')+".jpeg"


class Profile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    interests = models.CharField(max_length=250, blank=True)
    profile_description = models.TextField(max_length=2500, blank=True)
    timezone = models.CharField(max_length=30, blank=True)
    is_teacher = models.BooleanField(default=False)
    profile_picture = models.ImageField(upload_to=upload_profile_picture, null=True, blank=True)
    email_confirmed = models.BooleanField(default=False, blank=True)
    green_diamonds = models.SmallIntegerField(default=0, blank=True)  # Events
    yellow_diamonds = models.SmallIntegerField(default=0, blank=True)  # Online Live Course
    purple_diamonds = models.SmallIntegerField(default=0, blank=True)  # Pre Recorded Course
    blue_diamonds = models.SmallIntegerField(default=0, blank=True)  # Exam

    def __str__(self):
        return self.user.username


class CryptoCurrency(models.Model):
    name = models.CharField(max_length=50, blank=True, unique=True)
    code = models.CharField(max_length=10, blank=True)

    def __str__(self):
        return self.name


class AcceptedCrypto(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True)
    crypto = models.ForeignKey(CryptoCurrency, on_delete=models.CASCADE, null=True)
    address = models.CharField(max_length=250, blank=True)
    deleted = models.BooleanField(default=False)

    def __str__(self):
        return self.user.username + " - " + self.crypto.name


class ContactMethod(models.Model):
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
