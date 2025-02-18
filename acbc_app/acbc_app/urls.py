from django.urls import path, include

urlpatterns = [
    # ... other URL patterns ...
    path('api/knowledge-paths/', include('knowledge_paths.urls')),
] 