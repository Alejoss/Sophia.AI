from django.db import models
from django.contrib.auth.models import User
from django.db.models import JSONField


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
    url = models.URLField(max_length=200, blank=True, null=True)  # Added URL field
    extension = models.CharField(max_length=10, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    edition = models.CharField(max_length=50, blank=True, null=True)
    year = models.IntegerField(blank=True, null=True)
    author = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    file_size = models.PositiveIntegerField(blank=True, null=True)  # Size in bytes
    extracted_text = models.TextField(blank=True, null=True)
    text_length = models.PositiveIntegerField(blank=True, null=True)
    text_hash = models.CharField(max_length=64, blank=True, null=True)  # sha256
    ai_detection_result = JSONField(blank=True, null=True)  # Field to store AI detection result
    transaction_receipt = JSONField(blank=True, null=True)  # Transaction receipt from the StoreHash smart contract

    def save(self, *args, **kwargs):
        # Calculate file size in bytes
        if self.file and not self.file_size:
            self.file_size = self.file.size
        super().save(*args, **kwargs)
