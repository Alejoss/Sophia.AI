from rest_framework import serializers

from payments.models import CryptoPayment


class CryptoPaymentSerializer(serializers.ModelSerializer):
    pay_currency_display = serializers.SerializerMethodField()
    is_paid = serializers.BooleanField(read_only=True)

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
            'payment_status',
            'invoice_url',
            'actually_paid',
            'is_paid',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_pay_currency_display(self, obj):
        return dict(CryptoPayment.PAY_CURRENCIES).get(obj.pay_currency, obj.pay_currency.upper())
