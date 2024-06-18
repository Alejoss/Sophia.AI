from django.urls import path
from courses.api_views import (CommentList, CommentDetail, CertificateList, CertificateDetail,
                                        BookmarkList, BookmarkDetail, CertificateRequestList, CertificateRequestDetail,
                                        EventDetail, EventList)


urlpatterns = [
    # Urls for Events
    path('events/', EventList.as_view(), name='event_list'),
    path('events/<int:pk>/', EventDetail.as_view(), name='event_detail'),

    # URLs for Comments
    path('comments/', CommentList.as_view(), name='comment-list'),
    path('comments/<int:pk>/', CommentDetail.as_view(), name='comment-detail'),

    # URLs for Certificates
    path('certificates/', CertificateList.as_view(), name='certificate-list'),
    path('certificates/<int:pk>/', CertificateDetail.as_view(), name='certificate-detail'),

    # URLs for Bookmarks
    path('bookmarks/', BookmarkList.as_view(), name='bookmark-list'),
    path('bookmarks/<int:pk>/', BookmarkDetail.as_view(), name='bookmark-detail'),

    # URLs for Certificate Requests
    path('certificate-requests/', CertificateRequestList.as_view(), name='certificate-request-list'),
    path('certificate-requests/<int:pk>/', CertificateRequestDetail.as_view(), name='certificate-request-detail'),
]