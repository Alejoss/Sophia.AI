from django.urls import path

from content.views_social_preview import KnowledgePathSocialPreviewView

from .views_funding import (
    ProposalCampaignView,
    ProposalClaimView,
    ProposalContractView,
    ProposalUtxoView,
    ProposalDetailView,
    ProposalListCreateView,
    ProposalOpenView,
    ProposalPledgeView,
    ProposalRefundView,
)
from .views import (
    KnowledgePathListView,
    UserKnowledgePathsView,
    UserEngagedKnowledgePathsView,
    UserKnowledgePathsByUserIdView,
    KnowledgePathDetailView,
    KnowledgePathPurchaseView,
    KnowledgePathCreateView,
    KnowledgePathSnapshotPreviewView,
    KnowledgePathSnapshotReadinessView,
    KnowledgePathSnapshotListCreateView,
    KnowledgePathSnapshotDetailView,
    KnowledgePathSnapshotAnchorView,
    AdminKnowledgePathSnapshotDashboardView,
    NodeCreateView,
    NodeDeleteView,
    NodeDetailView,
    KnowledgePathBasicDetailView,
    NodeReorderView,
)

app_name = 'knowledge_paths'

urlpatterns = [
    path(
        'social-preview/<int:pk>/',
        KnowledgePathSocialPreviewView.as_view(),
        name='knowledge-path-social-preview',
    ),
    path('proposals/contract/', ProposalContractView.as_view(), name='path-proposal-contract'),
    path('proposals/utxos/', ProposalUtxoView.as_view(), name='path-proposal-utxos'),
    path('proposals/', ProposalListCreateView.as_view(), name='path-proposal-list'),
    path('proposals/<int:proposal_id>/', ProposalDetailView.as_view(), name='path-proposal-detail'),
    path('proposals/<int:proposal_id>/open/', ProposalOpenView.as_view(), name='path-proposal-open'),
    path('proposals/<int:proposal_id>/campaign/', ProposalCampaignView.as_view(), name='path-proposal-campaign'),
    path('proposals/<int:proposal_id>/pledges/', ProposalPledgeView.as_view(), name='path-proposal-pledges'),
    path('proposals/<int:proposal_id>/refund/', ProposalRefundView.as_view(), name='path-proposal-refund'),
    path('proposals/<int:proposal_id>/claim/', ProposalClaimView.as_view(), name='path-proposal-claim'),
    path('', KnowledgePathListView.as_view(), name='knowledge-path-list'),
    path('my/', UserKnowledgePathsView.as_view(), name='user-knowledge-paths'),
    path('engaged/', UserEngagedKnowledgePathsView.as_view(), name='user-engaged-knowledge-paths'),
    path('user/<int:user_id>/', UserKnowledgePathsByUserIdView.as_view(), name='user-knowledge-paths-by-id'),
    path('create/', KnowledgePathCreateView.as_view(), name='knowledge-path-create'),
    path(
        'admin/snapshots/',
        AdminKnowledgePathSnapshotDashboardView.as_view(),
        name='admin-knowledge-path-snapshots',
    ),
    path('<int:pk>/', KnowledgePathDetailView.as_view(), name='knowledge-path-detail'),
    path('<int:pk>/purchase/', KnowledgePathPurchaseView.as_view(), name='knowledge-path-purchase'),
    path('<int:path_id>/nodes/', NodeCreateView.as_view(), name='node-create'),
    path('<int:path_id>/nodes/<int:node_id>/', NodeDetailView.as_view(), name='node-detail'),
    path('<int:pk>/basic/', KnowledgePathBasicDetailView.as_view(), name='knowledge-path-basic-detail'),
    path(
        '<int:pk>/snapshot-preview/',
        KnowledgePathSnapshotPreviewView.as_view(),
        name='knowledge-path-snapshot-preview',
    ),
    path(
        '<int:pk>/snapshot-readiness/',
        KnowledgePathSnapshotReadinessView.as_view(),
        name='knowledge-path-snapshot-readiness',
    ),
    path(
        '<int:pk>/snapshots/',
        KnowledgePathSnapshotListCreateView.as_view(),
        name='knowledge-path-snapshots',
    ),
    path(
        '<int:pk>/snapshots/<int:version>/',
        KnowledgePathSnapshotDetailView.as_view(),
        name='knowledge-path-snapshot-detail',
    ),
    path(
        '<int:pk>/snapshots/<int:version>/anchor/',
        KnowledgePathSnapshotAnchorView.as_view(),
        name='knowledge-path-snapshot-anchor',
    ),
    path('<int:path_id>/nodes/reorder/', NodeReorderView.as_view(), name='node-reorder'),
] 