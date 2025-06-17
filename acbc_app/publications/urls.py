from django.urls import path
from .views import PublicationDetailView

print("\n=== Loading Publication URLs ===")
print("Registering URL patterns for publications app")

urlpatterns = [
    path('<int:publication_id>/', PublicationDetailView.as_view(), name='publication-detail'),
]

print("Registered URL patterns:", urlpatterns)
print("=== End Loading Publication URLs ===\n") 