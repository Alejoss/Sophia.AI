from django.contrib import admin

from payments.models import BchDirectPayment, CryptoPayment


@admin.register(CryptoPayment)
class CryptoPaymentAdmin(admin.ModelAdmin):
    list_display = (
        'order_id',
        'event_registration',
        'path_purchase',
        'anchor_request',
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
        'anchor_request__requester__username',
    )
    readonly_fields = ('created_at', 'updated_at', 'provider_payload')


@admin.register(BchDirectPayment)
class BchDirectPaymentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'anchor_request',
        'path_purchase',
        'topic_purchase',
        'expected_amount_sats',
        'usd_amount',
        'status',
        'payment_txid',
        'expires_at',
        'paid_at',
        'created_at',
    )
    list_filter = ('status', 'created_at')
    search_fields = (
        'payment_txid',
        'address',
        'anchor_request__requester__username',
        'anchor_request__text_hash',
    )
    raw_id_fields = ('anchor_request', 'path_purchase', 'topic_purchase')
    readonly_fields = ('created_at', 'updated_at', 'provider_payload', 'paid_at')
