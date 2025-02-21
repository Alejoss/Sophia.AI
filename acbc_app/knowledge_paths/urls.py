from django.urls import path
from .views import (
    KnowledgePathListView,
    KnowledgePathDetailView,
    KnowledgePathCreateView,
    NodeCreateView,
    NodeDeleteView,
    ActivityRequirementCreateView
)

app_name = 'knowledge_paths'

urlpatterns = [
    path('', KnowledgePathListView.as_view(), name='knowledge-path-list'),
    path('create/', KnowledgePathCreateView.as_view(), name='knowledge-path-create'),
    path('<int:pk>/', KnowledgePathDetailView.as_view(), name='knowledge-path-detail'),
    path('<int:path_id>/nodes/', NodeCreateView.as_view(), name='node-create'),
    path('<int:path_id>/nodes/<int:node_id>/', NodeDeleteView.as_view(), name='node-delete'),
    path('<int:path_id>/activity-requirements/', ActivityRequirementCreateView.as_view(), name='activity-requirement-create'),
] 