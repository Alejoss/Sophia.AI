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
    token_purchase = models.ForeignKey(
        'payments.TokenPurchase',
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
                        token_purchase__isnull=True,
                    )
                    | Q(
                        event_registration__isnull=True,
                        path_purchase__isnull=False,
                        anchor_request__isnull=True,
                        token_purchase__isnull=True,
                    )
                    | Q(
                        event_registration__isnull=True,
                        path_purchase__isnull=True,
                        anchor_request__isnull=False,
                        token_purchase__isnull=True,
                    )
                    | Q(
                        event_registration__isnull=True,
                        path_purchase__isnull=True,
                        anchor_request__isnull=True,
                        token_purchase__isnull=False,
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
        if self.token_purchase_id:
            return self.token_purchase.user
        return None


class BchDirectPayment(models.Model):
    """
    Self-custody BCH payment for anchors, paths, topics, or token packages.

    Unique amount (sats) on a single receive address; verify accepts payments
    within ``BCH_AMOUNT_TOLERANCE_USD`` of ``expected_amount_sats`` at the
    order's frozen ``usd_bch_rate``. User-triggered verification (no IPN).
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
        null=True,
        blank=True,
    )
    path_purchase = models.ForeignKey(
        'knowledge_paths.KnowledgePathPurchase',
        on_delete=models.CASCADE,
        related_name='bch_direct_payments',
        null=True,
        blank=True,
    )
    topic_purchase = models.ForeignKey(
        'content.TopicPurchase',
        on_delete=models.CASCADE,
        related_name='bch_direct_payments',
        null=True,
        blank=True,
    )
    token_purchase = models.ForeignKey(
        'payments.TokenPurchase',
        on_delete=models.CASCADE,
        related_name='bch_direct_payments',
        null=True,
        blank=True,
    )
    address = models.CharField(max_length=128)
    expected_amount_sats = models.BigIntegerField(
        help_text='Target amount in satoshis; verify allows BCH_AMOUNT_TOLERANCE_USD variance.',
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
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(
                        anchor_request__isnull=False,
                        path_purchase__isnull=True,
                        topic_purchase__isnull=True,
                        token_purchase__isnull=True,
                    )
                    | Q(
                        anchor_request__isnull=True,
                        path_purchase__isnull=False,
                        topic_purchase__isnull=True,
                        token_purchase__isnull=True,
                    )
                    | Q(
                        anchor_request__isnull=True,
                        path_purchase__isnull=True,
                        topic_purchase__isnull=False,
                        token_purchase__isnull=True,
                    )
                    | Q(
                        anchor_request__isnull=True,
                        path_purchase__isnull=True,
                        topic_purchase__isnull=True,
                        token_purchase__isnull=False,
                    )
                ),
                name='bchdirectpayment_exactly_one_target',
            ),
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
        from decimal import Decimal

        return Decimal(self.expected_amount_sats or 0) / Decimal(100_000_000)

    @property
    def buyer(self):
        if self.path_purchase_id:
            return self.path_purchase.user
        if self.topic_purchase_id:
            return self.topic_purchase.user
        if self.anchor_request_id:
            return self.anchor_request.requester
        if self.token_purchase_id:
            return self.token_purchase.user
        return None

    def mark_expired_if_needed(self):
        if self.status == self.STATUS_PENDING and timezone.now() >= self.expires_at:
            self.status = self.STATUS_EXPIRED
            self.save(update_fields=['status', 'updated_at'])
        return self


class TokenPackage(models.Model):
    """Staff-editable SKU of platform tokens sold for USD (paid in BCH / NOWPayments)."""

    name = models.CharField(max_length=80)
    token_amount = models.PositiveIntegerField()
    usd_price = models.DecimalField(max_digits=12, decimal_places=2)
    is_active = models.BooleanField(default=True, db_index=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'token_amount', 'id']

    def __str__(self):
        return f'{self.name} ({self.token_amount} tokens / ${self.usd_price})'


class TokenPurchase(models.Model):
    """A user's attempt to buy a token package. Repeatable (same package many times)."""

    PAYMENT_STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('PAID', 'Paid'),
        ('REFUNDED', 'Refunded'),
    )

    user = models.ForeignKey(
        'auth.User',
        on_delete=models.CASCADE,
        related_name='token_purchases',
    )
    package = models.ForeignKey(
        TokenPackage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchases',
    )
    package_name = models.CharField(max_length=80, blank=True, default='')
    token_amount = models.PositiveIntegerField()
    usd_price = models.DecimalField(max_digits=12, decimal_places=2)
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='PENDING',
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user_id} → {self.token_amount} tokens ({self.payment_status})'

    @property
    def is_paid(self):
        return self.payment_status == 'PAID'


class TokenLedgerEntry(models.Model):
    """Append-only platform token movements. Purchase credits are unique per TokenPurchase."""

    REASON_PURCHASE = 'purchase'
    REASON_ADJUSTMENT = 'adjustment'
    REASON_SPEND = 'spend'
    REASON_CHOICES = (
        (REASON_PURCHASE, 'Purchase'),
        (REASON_ADJUSTMENT, 'Adjustment'),
        (REASON_SPEND, 'Spend'),
    )

    user = models.ForeignKey(
        'auth.User',
        on_delete=models.CASCADE,
        related_name='token_ledger_entries',
    )
    delta = models.IntegerField(help_text='Signed token amount. Credits are positive.')
    reason = models.CharField(max_length=20, choices=REASON_CHOICES, db_index=True)
    token_purchase = models.ForeignKey(
        TokenPurchase,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ledger_entries',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['token_purchase'],
                condition=Q(reason='purchase') & Q(token_purchase__isnull=False),
                name='unique_token_purchase_ledger_credit',
            ),
        ]

    def __str__(self):
        sign = '+' if self.delta >= 0 else ''
        return f'{self.user_id} {sign}{self.delta} ({self.reason})'
