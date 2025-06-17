from django.urls import path
from .views import (
    CertificateRequestView,
    CertificateRequestListView,
    CertificateRequestActionView,
    CertificateRequestStatusView,
    KnowledgePathCertificateRequestsView,
    CertificateListView
)

app_name = 'certificates'

urlpatterns = [
    path('', CertificateListView.as_view(), name='certificate-list'),
    path('request/<int:path_id>/', CertificateRequestView.as_view(), name='certificate-request'),
    path('requests/', CertificateRequestListView.as_view(), name='certificate-request-list'),
    path('requests/<int:request_id>/<str:action>/', CertificateRequestActionView.as_view(), name='certificate-request-action'),
    path('request-status/<int:path_id>/', CertificateRequestStatusView.as_view(), name='certificate-request-status'),
    path('requests/knowledge-path/<int:path_id>/', KnowledgePathCertificateRequestsView.as_view(), name='knowledge-path-certificate-requests'),
] 