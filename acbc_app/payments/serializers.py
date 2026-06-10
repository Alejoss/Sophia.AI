from rest_framework import serializers

from payments.models import CryptoPayment


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
