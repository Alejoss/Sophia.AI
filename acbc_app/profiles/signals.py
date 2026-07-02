from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from notifications.models import Notification

from utils.notification_cache import invalidate_unread_count


@receiver(post_save, sender=Notification)
def invalidate_unread_count_on_notification_save(sender, instance, **kwargs):
    if instance.recipient_id:
        invalidate_unread_count(instance.recipient_id)


@receiver(post_delete, sender=Notification)
def invalidate_unread_count_on_notification_delete(sender, instance, **kwargs):
    if instance.recipient_id:
        invalidate_unread_count(instance.recipient_id)
