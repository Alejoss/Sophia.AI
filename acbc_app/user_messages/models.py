from django.db import models
from django.utils import timezone

from django.contrib.auth.models import User


class MessageThread(models.Model):
    # Manages conversation threads between two users, ensuring unique threads per user pair and
    # providing methods to create messages and retrieve conversation history.

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
    # Handles individual messages within a thread, including sender information, text content,
    # timestamp, and soft deletion functionality.

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
