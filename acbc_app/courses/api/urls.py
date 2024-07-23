from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (

    EventList,

)


#Crear un router
courses_router = DefaultRouter()

courses_router.register(r'courses', EventList)