from django.db import models
from django.db.models import Q
from django.utils import timezone


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
    anchor_request = models.ForeignKey(
        'content.TranscriptAnchorRequest',
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
                    Q(
                        event_registration__isnull=False,
                        path_purchase__isnull=True,
                        anchor_request__isnull=True,
                    )
                    | Q(
                        event_registration__isnull=True,
                        path_purchase__isnull=False,
                        anchor_request__isnull=True,
                    )
                    | Q(
                        event_registration__isnull=True,
                        path_purchase__isnull=True,
                        anchor_request__isnull=False,
                    )
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
        if self.anchor_request_id:
            return self.anchor_request.requester
        return None


class BchDirectPayment(models.Model):
    """
    Self-custody BCH payment for a TranscriptAnchorRequest.

    Unique exact amount (sats) on a single receive address; user-triggered
    verification against a public chain API (no webhooks/workers).
    """

    STATUS_PENDING = 'pending'
    STATUS_PAID = 'paid'
    STATUS_EXPIRED = 'expired'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending'),
        (STATUS_PAID, 'Paid'),
        (STATUS_EXPIRED, 'Expired'),
        (STATUS_CANCELLED, 'Cancelled'),
    )

    anchor_request = models.ForeignKey(
        'content.TranscriptAnchorRequest',
        on_delete=models.CASCADE,
        related_name='bch_direct_payments',
    )
    address = models.CharField(max_length=128)
    expected_amount_sats = models.BigIntegerField(
        help_text='Exact amount in satoshis the payer must send.',
    )
    usd_amount = models.DecimalField(max_digits=12, decimal_places=2)
    usd_bch_rate = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        help_text='USD per 1 BCH at order creation.',
    )
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
    )
    expires_at = models.DateTimeField()
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_txid = models.CharField(max_length=64, blank=True, null=True, unique=True)
    provider_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'expires_at'], name='bch_direct_status_exp_idx'),
            models.Index(fields=['expected_amount_sats'], name='bch_direct_sats_idx'),
        ]

    def __str__(self):
        return f'BCH {self.expected_amount_sats} sats → req {self.anchor_request_id} [{self.status}]'

    @property
    def is_expired(self):
        if self.status != self.STATUS_PENDING:
            return self.status == self.STATUS_EXPIRED
        return timezone.now() >= self.expires_at

    @property
    def expected_amount_bch(self):
        return (self.expected_amount_sats or 0) / 100_000_000

    def mark_expired_if_needed(self):
        if self.status == self.STATUS_PENDING and timezone.now() >= self.expires_at:
            self.status = self.STATUS_EXPIRED
            self.save(update_fields=['status', 'updated_at'])
        return self
