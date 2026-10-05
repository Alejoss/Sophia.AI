from django.contrib import admin

from payments.models import (
    BchDirectPayment,
    Course,
    CourseEvent,
    CoursePurchase,
    CryptoPayment,
    PayphonePayment,
    TokenLedgerEntry,
    TokenPackage,
    TokenPurchase,
)


@admin.register(PayphonePayment)
class PayphonePaymentAdmin(admin.ModelAdmin):
    list_display = (
        'client_transaction_id',
        'status',
        'amount_cents',
        'payphone_payment_id',
        'transaction_id',
        'event_registration',
        'path_purchase',
        'topic_purchase',
        'anchor_request',
        'token_purchase',
        'course_purchase',
        'created_at',
    )
    list_filter = ('status',)
    search_fields = (
        'client_transaction_id',
        'payphone_payment_id',
        'transaction_id',
        'event_registration__user__username',
        'path_purchase__user__username',
        'topic_purchase__user__username',
        'anchor_request__requester__username',
        'token_purchase__user__username',
        'course_purchase__user__username',
        'course_purchase__course__code',
    )
    readonly_fields = (
        'created_at', 'updated_at', 'provider_payload', 'confirm_payload', 'paid_at',
    )


@admin.register(CryptoPayment)
class CryptoPaymentAdmin(admin.ModelAdmin):
    list_display = (
        'order_id',
        'event_registration',
        'path_purchase',
        'anchor_request',
        'token_purchase',
        'course_purchase',
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
        'course_purchase__user__username',
        'course_purchase__course__code',
    )
    readonly_fields = ('created_at', 'updated_at', 'provider_payload')


class CourseEventInline(admin.TabularInline):
    model = CourseEvent
    extra = 0
    raw_id_fields = ('event',)


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('code', 'title', 'price_usd', 'sales_enabled', 'knowledge_path', 'updated_at')
    list_editable = ('price_usd', 'sales_enabled')
    search_fields = ('code', 'title')
    raw_id_fields = ('knowledge_path',)
    readonly_fields = ('created_at', 'updated_at')
    inlines = [CourseEventInline]


@admin.register(CourseEvent)
class CourseEventAdmin(admin.ModelAdmin):
    list_display = ('course', 'event', 'created_at')
    raw_id_fields = ('course', 'event')


@admin.register(CoursePurchase)
class CoursePurchaseAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'course',
        'price_amount',
        'receipt_email',
        'payment_status',
        'created_at',
    )
    list_filter = ('payment_status', 'course')
    search_fields = (
        'user__username',
        'user__email',
        'receipt_email',
        'course__code',
        'course__title',
    )
    readonly_fields = ('created_at', 'updated_at')


@admin.register(BchDirectPayment)
class BchDirectPaymentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'anchor_request',
        'path_purchase',
        'topic_purchase',
        'token_purchase',
        'course_purchase',
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
        'course_purchase__user__username',
        'course_purchase__course__code',
    )
    raw_id_fields = (
        'anchor_request',
        'path_purchase',
        'topic_purchase',
        'token_purchase',
        'course_purchase',
    )
    readonly_fields = ('created_at', 'updated_at', 'provider_payload', 'paid_at')


@admin.register(TokenPackage)
class TokenPackageAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'token_amount', 'bonus_tokens', 'usd_price', 'is_active', 'sort_order', 'updated_at',
    )
    list_filter = ('is_active',)
    list_editable = ('token_amount', 'bonus_tokens', 'usd_price', 'is_active', 'sort_order')
    search_fields = ('name',)
    ordering = ('sort_order', 'token_amount')


@admin.register(TokenPurchase)
class TokenPurchaseAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'package_name',
        'token_amount',
        'bonus_tokens',
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
