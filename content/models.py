from django.db import models
from django.contrib.auth.models import User


class Library(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, blank=True)


class Group(models.Model):
    library = models.ForeignKey(Library, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)


class File(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE)
    file = models.FileField(upload_to='files/')
    title = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(auto_now_add=True)
