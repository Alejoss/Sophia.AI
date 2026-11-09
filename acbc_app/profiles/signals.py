from django.contrib.auth.models import User
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver
from notifications.models import Notification

from utils.notification_cache import invalidate_unread_count


@receiver(pre_save, sender='socialaccount.SocialAccount')
def social_account_extra_data_for_database(sender, instance, **kwargs):
    """jsonb on SQL_ASCII cannot store a Google token that contains accents."""
    from utils.db_encoding import prepare_json_for_db

    instance.extra_data = prepare_json_for_db(instance.extra_data or {})


@receiver(post_save, sender=User)
def ensure_profile_for_user(sender, instance, created, **kwargs):
    """Every User must have a Profile (registration, OAuth, admin, seeds)."""
    if created:
        from profiles.models import Profile

        Profile.objects.get_or_create(user=instance)


@receiver(post_save, sender=Notification)
def invalidate_unread_count_on_notification_save(sender, instance, **kwargs):
    if instance.recipient_id:
        invalidate_unread_count(instance.recipient_id)


@receiver(post_delete, sender=Notification)
def invalidate_unread_count_on_notification_delete(sender, instance, **kwargs):
    if instance.recipient_id:
        invalidate_unread_count(instance.recipient_id)
