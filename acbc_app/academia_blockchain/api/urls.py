from django.urls import path,include
from rest_framework.routers import DefaultRouter
from profiles.api.urls import profiles_router
#from courses.api.urls import courses_router

router = DefaultRouter()
router.registry.extend(profiles_router.registry)
#router.registry.extend(courses_router.registry)


urlpatterns=[

    path('', include(router.urls)),
]