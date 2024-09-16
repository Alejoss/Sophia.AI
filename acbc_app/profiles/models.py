from datetime import datetime

from django.core.validators import URLValidator
from django.core.exceptions import ValidationError
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

from content.models import NodeOrder, ActivityRequirement


def upload_profile_picture(instance, filename):
    # TODO use django utils timezone
    return "profile_pictures/" + instance.user.username + "_" + datetime.today().strftime('%h-%d-%y') + ".jpeg"


class Profile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    interests = models.CharField(max_length=250, blank=True)
    profile_description = models.TextField(max_length=2500, blank=True)
    timezone = models.CharField(max_length=30, blank=True)
    is_teacher = models.BooleanField(default=False)
    profile_picture = models.ImageField(upload_to=upload_profile_picture, null=True, blank=True)
    email_confirmed = models.BooleanField(default=False, blank=True)

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


class UserProgressKnowledgePath(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    node_order = models.ForeignKey(NodeOrder, on_delete=models.CASCADE)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'node_order')  # Ensures each user-node_order pair is unique

    def __str__(self):
        status = 'Completed' if self.is_completed else 'Not Completed'
        return f"{self.user.username} - {self.node_order.node.title} ({status})"


class UserActivityStatus(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    activity_requirement = models.ForeignKey(ActivityRequirement, on_delete=models.CASCADE)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        status = 'Completed' if self.is_completed else 'Pending'
        return f"{self.user.username} - {self.activity_requirement} ({status})"


class MessageThread(models.Model):
    # Participants of the conversation
    participant1 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='threads_as_participant1')
    participant2 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='threads_as_participant2')

    def __str__(self):
        return f"{self.participant1.username} and {self.participant2.username} Conversation"

    @classmethod
    def get_or_create_thread(cls, user1, user2):
        if user1.pk > user2.pk:
            user1, user2 = user2, user1  # Ensure consistent ordering
        thread, created = cls.objects.get_or_create(participant1=user1, participant2=user2)
        return thread

    def send_message(self, sender, message_text):
        message = self.messages.create(sender=sender, text=message_text)
        return message

    def get_messages(self):
        return self.messages.all().order_by('timestamp')


class Message(models.Model):
    thread = models.ForeignKey('MessageThread', related_name='messages', on_delete=models.CASCADE)
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    text = models.TextField()
    timestamp = models.DateTimeField(default=timezone.now)
    deleted_at = models.DateTimeField(null=True, blank=True)  # Tracks when the message was deleted

    def __str__(self):
        return f"Message from {self.sender.username} at {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"

    class Meta:
        ordering = ['-timestamp']

    def delete_message(self):
        """ Mark the message as deleted. """
        self.deleted_at = timezone.now()
        self.save()

    def is_visible(self):
        """ Check if the message is still visible (not deleted). """
        return self.deleted_at is None
