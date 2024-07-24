from django.urls import path,include

# profiles/api/urls.py
from django.urls import path
from academia_blockchain.api.api import ApiRoot

urlpatterns = [
    path('', ApiRoot.as_view(), name='api-root'),
    path('profiles/', include('profiles.api.urls')),
    path('courses/', include('courses.api.urls')),
]
