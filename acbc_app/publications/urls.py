from django.urls import path
from .views import PublicationDetailView

urlpatterns = [
    path('<int:publication_id>/', PublicationDetailView.as_view(), name='publication-detail'),
] 