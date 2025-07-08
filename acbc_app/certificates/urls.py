from django.urls import path
from .views import (
    CertificateRequestView,
    CertificateRequestListView,
    CertificateRequestActionView,
    CertificateRequestStatusView,
    KnowledgePathCertificateRequestsView,
    CertificateListView,
    EventCertificateRequestView,
    EventCertificateRequestStatusView,
    EventCertificateRequestsView,
    EventCertificateGenerationView
)

app_name = 'certificates'

urlpatterns = [
    path('', CertificateListView.as_view(), name='certificate-list'),
    path('request/<int:path_id>/', CertificateRequestView.as_view(), name='certificate-request'),
    path('requests/', CertificateRequestListView.as_view(), name='certificate-request-list'),
    path('requests/<int:request_id>/<str:action>/', CertificateRequestActionView.as_view(), name='certificate-request-action'),
    path('request-status/<int:path_id>/', CertificateRequestStatusView.as_view(), name='certificate-request-status'),
    path('requests/knowledge-path/<int:path_id>/', KnowledgePathCertificateRequestsView.as_view(), name='knowledge-path-certificate-requests'),
    
    # Event certificate endpoints
    path('event-request/<int:event_id>/', EventCertificateRequestView.as_view(), name='event-certificate-request'),
    path('event-request-status/<int:event_id>/', EventCertificateRequestStatusView.as_view(), name='event-certificate-request-status'),
    path('requests/event/<int:event_id>/', EventCertificateRequestsView.as_view(), name='event-certificate-requests'),
    path('generate-event-certificate/<int:event_id>/<int:registration_id>/', EventCertificateGenerationView.as_view(), name='generate-event-certificate'),
] 