from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (

    ProfileList,

)

# Crear un router
profiles_router = DefaultRouter()

profiles_router.register(r'profiles', ProfileList)
