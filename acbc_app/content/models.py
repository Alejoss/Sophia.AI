from django.db import models
from django.contrib.auth.models import User


class Library(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, blank=True)


class Group(models.Model):
    library = models.ForeignKey(Library, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)


class File(models.Model):
    library = models.ForeignKey(Library, on_delete=models.CASCADE, null=True, blank=True)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, null=True, blank=True)
    file = models.FileField(upload_to='files/')
    title = models.CharField(max_length=255)
    extension = models.CharField(max_length=10, blank=True)  # Existing field
    uploaded_at = models.DateTimeField(auto_now_add=True)
    edition = models.CharField(max_length=50, blank=True, null=True)
    year = models.IntegerField(blank=True, null=True)
    author = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    file_size = models.PositiveIntegerField(blank=True, null=True)  # Size in bytes

    def save(self, *args, **kwargs):
        # Calculate file size in bytes
        if self.file and not self.file_size:
            self.file_size = self.file.size
        super().save(*args, **kwargs)
