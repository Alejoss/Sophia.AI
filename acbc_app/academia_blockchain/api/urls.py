from profiles.api.views import ProfileList, ProfileDetail
from django.urls import path, include

from courses.api.views import EventList,EventDetail

from content.api.views import (LibraryList, LibraryDetail, GroupList, GroupDetail,
                                    FileList, FileDetail)

from academia_blockchain.api.api import ApiRoot

urlpatterns = [

    path('', ApiRoot.as_view(), name='api-root'),
    path('profiles/', ProfileList.as_view(), name='profile-list'),
    path('profiles/<int:pk>/', ProfileDetail.as_view(), name='profile-detail'),
    path('courses/', EventList.as_view(), name='course-list'),
    path('courses/<int:pk>/', EventDetail.as_view(), name='course-detail'),
    path('libraries/', LibraryList.as_view(), name='library-list'),
    path('libraries/<int:pk>/', LibraryDetail.as_view(), name='library-detail'),
    path('groups/', GroupList.as_view(), name='group-list'),
    path('groups/<int:pk>/', GroupDetail.as_view(), name='group-detail'),
    path('files/', FileList.as_view(), name='file-list'),
    path('files/<int:pk>/', FileDetail.as_view(), name='file-detail'),




]


