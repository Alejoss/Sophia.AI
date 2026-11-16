from django.contrib import admin
from .models import (
    KnowledgePath,
    KnowledgePathPurchase,
    KnowledgePathSnapshotAnchor,
    Node,
    PathPledge,
    PathProposal,
    PublishedKnowledgePathSnapshot,
)


@admin.register(KnowledgePath)
class KnowledgePathAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'author',
        'reference_price',
        'sales_enabled',
        'is_visible',
        'certificates_enabled',
        'created_at',
        'updated_at',
        'vote_count',
    )
    search_fields = ('title', 'description', 'author__username')
    list_filter = ('is_visible', 'certificates_enabled', 'sales_enabled', 'created_at', 'updated_at')
    list_editable = ('sales_enabled',)
    readonly_fields = ('vote_count',)

    def vote_count(self, obj):
        return obj.vote_count
    vote_count.short_description = 'Votes'


@admin.register(KnowledgePathPurchase)
class KnowledgePathPurchaseAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'knowledge_path', 'payment_status', 'price_amount', 'created_at')
    list_filter = ('payment_status', 'created_at')
    search_fields = ('user__username', 'knowledge_path__title')


@admin.register(Node)
class NodeAdmin(admin.ModelAdmin):
    list_display = ('title', 'knowledge_path', 'media_type', 'created_at')
    list_filter = ('media_type', 'created_at')
    search_fields = ('title', 'description', 'knowledge_path__title')


@admin.register(PublishedKnowledgePathSnapshot)
class PublishedKnowledgePathSnapshotAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'knowledge_path',
        'version',
        'digest',
        'published_by',
        'published_at',
    )
    list_filter = ('schema_version', 'published_at')
    search_fields = ('knowledge_path__title', 'digest', 'published_by__username')
    readonly_fields = (
        'knowledge_path',
        'version',
        'schema_version',
        'document_text',
        'digest',
        'published_at',
        'published_by',
    )


@admin.register(PathProposal)
class PathProposalAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'frozen_title',
        'author',
        'status',
        'goal_sats',
        'raised_sats',
        'deadline',
    )
    list_filter = ('status', 'deadline')
    search_fields = ('frozen_title', 'author__username', 'author_payout_address', 'campaign_txid')
    readonly_fields = (
        'knowledge_path',
        'author',
        'frozen_title',
        'frozen_pitch',
        'goal_sats',
        'deadline',
        'author_payout_address',
        'terms_hash',
        'status',
        'raised_sats',
        'campaign_txid',
        'campaign_vout',
        'contract_address',
        'token_category',
        'settlement_txid',
        'created_at',
        'updated_at',
    )


@admin.register(PathPledge)
class PathPledgeAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'proposal',
        'wallet_address',
        'amount_sats',
        'status',
        'created_at',
    )
    list_filter = ('status',)
    search_fields = ('wallet_address', 'pledge_txid', 'nft_txid', 'refund_txid')
    readonly_fields = (
        'proposal',
        'user',
        'wallet_address',
        'amount_sats',
        'pledge_txid',
        'vout',
        'nft_category',
        'nft_commitment',
        'nft_txid',
        'nft_vout',
        'status',
        'refund_txid',
        'created_at',
        'updated_at',
    )


@admin.register(KnowledgePathSnapshotAnchor)
class KnowledgePathSnapshotAnchorAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'snapshot',
        'digest',
        'status',
        'btc_network',
        'btc_txid',
        'btc_confirmations',
        'anchored_by',
        'updated_at',
    )
    list_filter = ('status', 'btc_network', 'created_at')
    search_fields = (
        'digest',
        'btc_txid',
        'snapshot__knowledge_path__title',
        'anchored_by__username',
    )
    readonly_fields = (
        'snapshot',
        'digest',
        'op_return_prefix',
        'btc_op_return_hex',
        'btc_txid',
        'btc_block_height',
        'btc_block_hash',
        'btc_confirmations',
        'btc_confirmed_at',
        'created_at',
        'updated_at',
    )
