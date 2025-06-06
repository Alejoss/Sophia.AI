from django.urls import path
from .views import (
    CertificateRequestView,
    CertificateRequestListView,
    CertificateRequestActionView,
    CertificateRequestStatusView
)

app_name = 'certificates'

urlpatterns = [
    path('request/<int:path_id>/', CertificateRequestView.as_view(), name='certificate-request'),
    path('requests/', CertificateRequestListView.as_view(), name='certificate-request-list'),
    path('requests/<int:request_id>/<str:action>/', CertificateRequestActionView.as_view(), name='certificate-request-action'),
    path('request-status/<int:path_id>/', CertificateRequestStatusView.as_view(), name='certificate-request-status'),
] 