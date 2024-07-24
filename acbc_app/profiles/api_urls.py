from django.urls import path
from profiles.api_views import ProfileList, ProfileDetail, AcceptedCryptoList

urlpatterns = [
    path('profiles/', ProfileList.as_view(), name='profile-list'),
    path('<int:pk>/', ProfileDetail.as_view(), name='profile-detail'),
    path('cryptos/', AcceptedCryptoList.as_view(), name='crypto-list'),
]
