from django.db import models
from django.db.models import Q


class CryptoPayment(models.Model):
    """Tracks a NOWPayments invoice/payment linked to exactly one entitlement."""

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

    event_registration = models.ForeignKey(
        'events.EventRegistration',
        on_delete=models.CASCADE,
        related_name='crypto_payments',
        null=True,
        blank=True,
    )
    path_purchase = models.ForeignKey(
        'knowledge_paths.KnowledgePathPurchase',
        on_delete=models.CASCADE,
        related_name='crypto_payments',
        null=True,
        blank=True,
    )
    order_id = models.CharField(max_length=128, unique=True)
    nowpayments_payment_id = models.BigIntegerField(null=True, blank=True, db_index=True)
    pay_currency = models.CharField(max_length=16, blank=True, default='')
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
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(event_registration__isnull=False, path_purchase__isnull=True)
                    | Q(event_registration__isnull=True, path_purchase__isnull=False)
                ),
                name='cryptopayment_exactly_one_target',
            ),
        ]

    def __str__(self):
        label = self.pay_currency.upper() if self.pay_currency else 'NOWPayments'
        return f'{self.order_id} ({label}) — {self.payment_status}'

    @property
    def is_paid(self):
        """True when NOWPayments reports finished (funds in merchant wallet)."""
        return self.payment_status == 'finished'

    @property
    def buyer(self):
        if self.event_registration_id:
            return self.event_registration.user
        if self.path_purchase_id:
            return self.path_purchase.user
        return None
