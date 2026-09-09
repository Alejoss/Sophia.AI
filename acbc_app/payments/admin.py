from django.contrib import admin

from payments.models import (
    BchDirectPayment,
    CryptoPayment,
    TokenLedgerEntry,
    TokenPackage,
    TokenPurchase,
)


@admin.register(CryptoPayment)
class CryptoPaymentAdmin(admin.ModelAdmin):
    list_display = (
        'order_id',
        'event_registration',
        'path_purchase',
        'anchor_request',
        'token_purchase',
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
        'token_purchase__user__username',
    )
    readonly_fields = ('created_at', 'updated_at', 'provider_payload')


@admin.register(BchDirectPayment)
class BchDirectPaymentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'anchor_request',
        'path_purchase',
        'topic_purchase',
        'token_purchase',
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
        'token_purchase__user__username',
    )
    raw_id_fields = ('anchor_request', 'path_purchase', 'topic_purchase', 'token_purchase')
    readonly_fields = ('created_at', 'updated_at', 'provider_payload', 'paid_at')


@admin.register(TokenPackage)
class TokenPackageAdmin(admin.ModelAdmin):
    list_display = ('name', 'token_amount', 'usd_price', 'is_active', 'sort_order', 'updated_at')
    list_filter = ('is_active',)
    list_editable = ('token_amount', 'usd_price', 'is_active', 'sort_order')
    search_fields = ('name',)
    ordering = ('sort_order', 'token_amount')


@admin.register(TokenPurchase)
class TokenPurchaseAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'package_name',
        'token_amount',
        'usd_price',
        'payment_status',
        'created_at',
    )
    list_filter = ('payment_status',)
    search_fields = ('user__username', 'package_name')
    raw_id_fields = ('user', 'package')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(TokenLedgerEntry)
class TokenLedgerEntryAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'delta', 'reason', 'token_purchase', 'created_at')
    list_filter = ('reason',)
    search_fields = ('user__username',)
    raw_id_fields = ('user', 'token_purchase')
    readonly_fields = ('user', 'delta', 'reason', 'token_purchase', 'created_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
