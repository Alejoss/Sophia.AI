from django.urls import path
from . import views


urlpatterns = [
    # Library URLs
    path('libraries/', views.library_list, name='library_list'),
    path('libraries/user_library', views.user_library, name='user_library'),
    path('libraries/<int:library_id>', views.library_detail, name='library_detail'),
    path('libraries/user_library/file_upload', views.file_upload, name='file_upload'),
    path('files/<int:file_id>/', views.file_detail, name='file_detail'),
    path('hash-pdf/<int:file_id>/', views.hash_pdf_view, name='hash_pdf_view'),
    path('run-ai-detection/<int:file_id>/', views.run_ai_detection_view, name='run_ai_detection'),
    path('libraries/send_hash_to_sc/<int:file_id>/', views.send_hash_to_sc, name='send_hash_to_sc'),
    path('libraries/interact_with_hash_store_sc', views.interact_with_hash_store_sc, name='interact_with_hash_store_sc'),
    path('libraries/interact_with_acbc_token_sc', views.interact_with_acbc_token_sc, name='interact_with_acbc_token_sc'),
    path('libraries/test_unstoppable', views.test_unstoppable, name='test_unstoppable'),

    path('libraries/new/', views.library_create, name='library_create'),
    path('libraries/<int:pk>/edit/', views.library_update, name='library_update'),
    path('libraries/<int:pk>/delete/', views.library_delete, name='library_delete'),

    # Group URLs within a Library
    path('libraries/<int:library_id>/groups/', views.group_list, name='group_list'),
    path('libraries/<int:library_id>/groups/new/', views.group_create, name='group_create'),
    path('groups/<int:pk>/edit/', views.group_update, name='group_update'),
    path('groups/<int:pk>/delete/', views.group_delete, name='group_delete'),

    # File URLs within a Group
    path('groups/<int:group_id>/files/', views.file_list, name='file_list'),
    path('groups/<int:group_id>/files/new/', views.file_create, name='file_create'),
    path('files/<int:pk>/edit/', views.file_update, name='file_update'),
    path('files/<int:pk>/delete/', views.file_delete, name='file_delete'),
]
