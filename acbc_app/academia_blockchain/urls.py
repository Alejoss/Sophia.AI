from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include, re_path
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from profiles.views import GoogleLoginView

schema_view = get_schema_view(
    openapi.Info(
        title="Academia Blockchain API",
        default_version='v1',
        description="API documentation for ACBC",
        terms_of_service="proximamente",
        contact=openapi.Contact(email="academiablockchain@gmail.com"),
        license=openapi.License(name="MIT License"),
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/profiles/', include('profiles.urls')),
    path('api/events/', include('events.urls')),
    path('api/content/', include('content.urls')),
    path('api/comments/', include('comments.urls')),
    path('api/quizzes/', include('quizzes.urls')),
    path('api/votes/', include('votes.urls')),
    path('api/knowledge_paths/', include('knowledge_paths.urls')),
    path('api/search/', include('search.urls')),
    path('api/messages/', include('user_messages.urls')),
    path('api/certificates/', include('certificates.urls')),
    path('api/bookmarks/', include('bookmarks.urls')),
    path('api/gamification/', include('gamification.urls')),
    
    # dj-rest-auth URLs
    path('api/rest-auth/', include('dj_rest_auth.urls')),
    path('api/rest-auth/registration/', include('dj_rest_auth.registration.urls')),
    
    # django-allauth URLs
    path('accounts/', include('allauth.urls')),
    
    # Custom Google login endpoint
    path('api/rest-auth/google/login/', GoogleLoginView.as_view(), name='google_login'),
    
    re_path(r'^swagger(?P<format>\.json|\.yaml)$', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    path('api/notifications/', include('notifications.urls', namespace='notifications')),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
