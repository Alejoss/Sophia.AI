from django.urls import path, include

from profiles.api.views import (ProfileList, ProfileDetail, UserDetailView, UserListView,
                                UserProfileView, Logout, Login, GetCsrfToken)
from events.api.views import EventList, EventDetail
from content.api.views import (LibraryList, LibraryDetail, GroupList, GroupDetail, FileList,
                               FileDetail)
from academia_blockchain.api.api import ApiRoot


urlpatterns = [
    path('', ApiRoot.as_view(), name='api-root'),
    path('user_profile/', UserProfileView.as_view(), name='user_profile'),
    path('profiles/', ProfileList.as_view(), name='profile-list'),
    path('profiles/<int:pk>/', ProfileDetail.as_view(), name='profile-detail'),
    path('profiles/get_csrf_token/', GetCsrfToken.as_view(), name='get_csrf_token'),
    path('profiles/login/', Login.as_view(), name='login'),
    path('profiles/logout/', Logout.as_view(), name='logout'),
    path('users/', UserListView.as_view(), name='user-detail'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='file-detail'),

    path('events/', EventList.as_view(), name='event-list'),
    path('events/<int:pk>/', EventDetail.as_view(), name='event-detail'),
    path('libraries/', LibraryList.as_view(), name='library-list'),
    path('libraries/<int:pk>/', LibraryDetail.as_view(), name='library-detail'),
    path('groups/', GroupList.as_view(), name='group-list'),
    path('groups/<int:pk>/', GroupDetail.as_view(), name='group-detail'),
    path('files/', FileList.as_view(), name='file-list'),
    path('files/<int:pk>/', FileDetail.as_view(), name='file-detail'),


]
