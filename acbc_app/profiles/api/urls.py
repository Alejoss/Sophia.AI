from django.urls import path, include
from rest_framework.routers import DefaultRouter


# Crear un router
#profiles_router = DefaultRouter()

#profiles_router.register(r'profiles', ProfileList)
# profiles/api/urls.py
from django.urls import path

# profiles/api/urls.py
from django.urls import path
from .views import ProfileList, ProfileDetail

urlpatterns = [
    path('profiles/', ProfileList.as_view(), name='profile-list'),
    path('profiles/<int:pk>/', ProfileDetail.as_view(), name='profile-detail'),
]
