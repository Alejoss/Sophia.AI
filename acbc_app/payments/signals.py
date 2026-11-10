"""Send the course receipt once, when a purchase first becomes paid."""

from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from payments.models import CoursePurchase


@receiver(pre_save, sender=CoursePurchase)
def remember_course_payment_status(sender, instance, **kwargs):
    if not instance.pk:
        instance._payment_status_before = None
        return
    instance._payment_status_before = (
        sender.objects.filter(pk=instance.pk)
        .values_list('payment_status', flat=True)
        .first()
    )


@receiver(post_save, sender=CoursePurchase)
def email_buyer_when_course_purchase_paid(sender, instance, **kwargs):
    previous = getattr(instance, '_payment_status_before', None)
    if instance.payment_status != 'PAID' or previous == 'PAID':
        return
    purchase_id = instance.pk

    def _send():
        from payments.course_receipt import send_course_purchase_receipt

        try:
            purchase = CoursePurchase.objects.get(pk=purchase_id)
        except CoursePurchase.DoesNotExist:
            return
        send_course_purchase_receipt(purchase)

    transaction.on_commit(_send)
