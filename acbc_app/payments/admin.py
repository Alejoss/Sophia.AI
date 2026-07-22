from django.contrib import admin

from payments.models import CryptoPayment


@admin.register(CryptoPayment)
class CryptoPaymentAdmin(admin.ModelAdmin):
    list_display = (
        'order_id',
        'event_registration',
        'path_purchase',
        'pay_currency',
        'payment_status',
        'price_amount',
        'nowpayments_payment_id',
        'created_at',
    )
    list_filter = ('payment_status', 'pay_currency')
    search_fields = (
        'order_id',
        'pay_address',
        'event_registration__user__username',
        'path_purchase__user__username',
    )
    readonly_fields = ('created_at', 'updated_at', 'provider_payload')
