from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include, re_path
from django.http import JsonResponse
from django.views.static import serve
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from profiles.views import GoogleLoginView

def health_check(request):
    """Health check endpoint for monitoring"""
    return JsonResponse({"status": "healthy", "service": "academia_blockchain"})

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
    path('health/', health_check, name='health_check'),
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

# Serve media files
# Static files are served by WhiteNoise middleware in production (no need for static() helper)
# Only skip if actually using S3 storage (check if STATICFILES_STORAGE is set to S3)
use_s3_storage = hasattr(settings, 'STATICFILES_STORAGE') and 's3' in str(getattr(settings, 'STATICFILES_STORAGE', '')).lower()

if not use_s3_storage:
    # WhiteNoise handles static files automatically via middleware
    # For media files: Django serves them when Nginx proxies requests
    # In development (DEBUG=True), static() works automatically
    # In production (DEBUG=False), we need to explicitly serve media files
    if settings.DEBUG:
        # Development: use Django's static() helper
        urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    else:
        # Production: serve media files explicitly (Nginx proxies to Django)
        # This allows Django to serve media files even when DEBUG=False
        urlpatterns += [
            re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
        ]
