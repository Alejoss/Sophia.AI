from django.db import models
from django.conf import settings


class CryptoPayment(models.Model):
    """Tracks a NOWPayments invoice/payment linked to an event registration."""

    PAY_CURRENCIES = (
        ('bch', 'Bitcoin Cash'),
        ('xmr', 'Monero'),
    )

    STATUS_CHOICES = (
        ('waiting', 'Waiting'),
        ('confirming', 'Confirming'),
        ('confirmed', 'Confirmed'),
        ('sending', 'Sending'),
        ('partially_paid', 'Partially paid'),
        ('finished', 'Finished'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
        ('expired', 'Expired'),
    )

    registration = models.ForeignKey(
        'events.EventRegistration',
        on_delete=models.CASCADE,
        related_name='crypto_payments',
    )
    order_id = models.CharField(max_length=128, unique=True)
    nowpayments_payment_id = models.BigIntegerField(null=True, blank=True, db_index=True)
    pay_currency = models.CharField(max_length=10, choices=PAY_CURRENCIES)
    price_amount = models.FloatField()
    price_currency = models.CharField(max_length=10, default='usd')
    pay_amount = models.DecimalField(max_digits=24, decimal_places=12, null=True, blank=True)
    pay_address = models.CharField(max_length=256, blank=True)
    payment_status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='waiting')
    invoice_url = models.URLField(max_length=512, blank=True)
    actually_paid = models.DecimalField(max_digits=24, decimal_places=12, null=True, blank=True)
    provider_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.order_id} ({self.pay_currency.upper()}) — {self.payment_status}'

    @property
    def is_paid(self):
        return self.payment_status in ('finished', 'confirmed')
