from django.urls import path
from .views import (
    KnowledgePathListView,
    UserKnowledgePathsView,
    UserEngagedKnowledgePathsView,
    UserKnowledgePathsByUserIdView,
    KnowledgePathDetailView,
    KnowledgePathCreateView,
    NodeCreateView,
    NodeDeleteView,
    NodeDetailView,
    KnowledgePathBasicDetailView,
    NodeReorderView,
)

app_name = 'knowledge_paths'

urlpatterns = [
    path('', KnowledgePathListView.as_view(), name='knowledge-path-list'),
    path('my/', UserKnowledgePathsView.as_view(), name='user-knowledge-paths'),
    path('engaged/', UserEngagedKnowledgePathsView.as_view(), name='user-engaged-knowledge-paths'),
    path('user/<int:user_id>/', UserKnowledgePathsByUserIdView.as_view(), name='user-knowledge-paths-by-id'),
    path('create/', KnowledgePathCreateView.as_view(), name='knowledge-path-create'),
    path('<int:pk>/', KnowledgePathDetailView.as_view(), name='knowledge-path-detail'),
    path('<int:path_id>/nodes/', NodeCreateView.as_view(), name='node-create'),
    path('<int:path_id>/nodes/<int:node_id>/', NodeDetailView.as_view(), name='node-detail'),
    path('<int:pk>/basic/', KnowledgePathBasicDetailView.as_view(), name='knowledge-path-basic-detail'),
    path('<int:path_id>/nodes/reorder/', NodeReorderView.as_view(), name='node-reorder'),
] 