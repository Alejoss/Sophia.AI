"""academia_blockchain URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include

from events import views as event_views


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('academia_blockchain.api.urls')),
    path('', event_views.events_all, name="events_all"),
    path('accounts/', include('allauth.urls')),
    path('events/', include('events.urls')),
    # path('exams/', include('exams.urls')),
    path('profiles/', include('profiles.urls')),
    path('content/', include('content.urls')),
    path('ratings/', include('star_ratings.urls', namespace='ratings'))
]


if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
