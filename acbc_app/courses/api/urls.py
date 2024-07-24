from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (

    EventList,

)


#Crear un router
#courses_router = DefaultRouter()

#courses_router.register(r'courses', EventList)

from .views import EventList,EventDetail

urlpatterns = [
    path('courses/', EventList.as_view(), name='course-list'),
    path('courses/<int:pk>/', EventDetail.as_view(), name='course-detail'),
]
