from rest_framework import serializers

from payments.models import BchDirectPayment, CryptoPayment


class CryptoPaymentSerializer(serializers.ModelSerializer):
    pay_currency_display = serializers.SerializerMethodField()
    is_paid = serializers.BooleanField(read_only=True)
    payin_extra_id = serializers.SerializerMethodField()

    class Meta:
        model = CryptoPayment
        fields = [
            'id',
            'order_id',
            'nowpayments_payment_id',
            'pay_currency',
            'pay_currency_display',
            'price_amount',
            'price_currency',
            'pay_amount',
            'pay_address',
            'payin_extra_id',
            'payment_status',
            'invoice_url',
            'actually_paid',
            'is_paid',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_pay_currency_display(self, obj):
        if not obj.pay_currency:
            return 'NOWPayments'
        return dict(CryptoPayment.PAY_CURRENCIES).get(obj.pay_currency, obj.pay_currency.upper())

    def get_payin_extra_id(self, obj):
        payload = obj.provider_payload or {}
        extra = payload.get('payin_extra_id') or payload.get('payment_extra_id')
        if extra:
            return extra
        payment_extra_ids = payload.get('payment_extra_ids')
        if isinstance(payment_extra_ids, list) and payment_extra_ids:
            return payment_extra_ids[0]
        return payment_extra_ids


class BchDirectPaymentSerializer(serializers.ModelSerializer):
    expected_amount_bch = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)
    seconds_remaining = serializers.SerializerMethodField()
    network = serializers.SerializerMethodField()

    class Meta:
        model = BchDirectPayment
        fields = [
            'id',
            'anchor_request',
            'address',
            'expected_amount_sats',
            'expected_amount_bch',
            'usd_amount',
            'usd_bch_rate',
            'status',
            'network',
            'expires_at',
            'paid_at',
            'payment_txid',
            'is_expired',
            'seconds_remaining',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_expected_amount_bch(self, obj):
        return f'{obj.expected_amount_bch:.8f}'

    def get_network(self, obj):
        from payments.bch_client import get_bch_network
        payload = obj.provider_payload or {}
        return payload.get('network') or get_bch_network()

    def get_seconds_remaining(self, obj):
        from django.utils import timezone
        if obj.status != BchDirectPayment.STATUS_PENDING:
            return 0
        delta = obj.expires_at - timezone.now()
        return max(0, int(delta.total_seconds()))


class AdminBchOrderSerializer(BchDirectPaymentSerializer):
    """Staff inbox row: product + buyer context for manual TXID confirmation."""

    product_type = serializers.SerializerMethodField()
    product_id = serializers.SerializerMethodField()
    product_title = serializers.SerializerMethodField()
    buyer_id = serializers.SerializerMethodField()
    buyer_username = serializers.SerializerMethodField()
    path_purchase_id = serializers.IntegerField(read_only=True)
    topic_purchase_id = serializers.IntegerField(read_only=True)
    anchor_request_id = serializers.IntegerField(read_only=True)

    class Meta(BchDirectPaymentSerializer.Meta):
        fields = BchDirectPaymentSerializer.Meta.fields + [
            'product_type',
            'product_id',
            'product_title',
            'buyer_id',
            'buyer_username',
            'path_purchase_id',
            'topic_purchase_id',
            'anchor_request_id',
        ]

    def get_product_type(self, obj):
        if obj.path_purchase_id:
            return 'path'
        if obj.topic_purchase_id:
            return 'topic'
        if obj.anchor_request_id:
            return 'anchor'
        return None

    def get_product_id(self, obj):
        if obj.path_purchase_id and obj.path_purchase:
            return obj.path_purchase.knowledge_path_id
        if obj.topic_purchase_id and obj.topic_purchase:
            return obj.topic_purchase.topic_id
        if obj.anchor_request_id:
            return obj.anchor_request_id
        return None

    def get_product_title(self, obj):
        if obj.path_purchase_id and obj.path_purchase and obj.path_purchase.knowledge_path_id:
            return obj.path_purchase.knowledge_path.title
        if obj.topic_purchase_id and obj.topic_purchase and obj.topic_purchase.topic_id:
            return obj.topic_purchase.topic.title
        if obj.anchor_request_id:
            return f'Anclaje #{obj.anchor_request_id}'
        return None

    def get_buyer_id(self, obj):
        buyer = obj.buyer
        return buyer.id if buyer else None

    def get_buyer_username(self, obj):
        buyer = obj.buyer
        return buyer.username if buyer else None
