from django.urls import path
from .views import KnowledgePathCreateView, KnowledgePathDetailView

app_name = 'knowledge_paths'

urlpatterns = [
    path('create/', KnowledgePathCreateView.as_view(), name='knowledge-path-create'),
    path('<int:pk>/', KnowledgePathDetailView.as_view(), name='knowledge-path-detail'),
] 