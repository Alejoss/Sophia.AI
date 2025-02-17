from django.urls import path

from content import views

app_name = "content"

urlpatterns = [
    path('libraries/', views.LibraryListView.as_view(), name='library_list'),
    path('libraries/<int:pk>/', views.LibraryDetailView.as_view(), name='library_detail'),
    path('collections/', views.UserCollectionsView.as_view(), name='user-collections'),
    path('collections/<int:collection_id>/content/', views.CollectionContentView.as_view(), name='collection-content'),
    path('contents/', views.ContentListView.as_view(), name='content_list'),
    path('content_details/<int:pk>/', views.ContentDetailView.as_view(), name='content-detail'),
    path('knowledge-paths/', views.KnowledgePathListView.as_view(), name='knowledge_path_list'),
    path('knowledge-paths/<int:pk>/', views.KnowledgePathDetailView.as_view(), name='knowledge_path_detail'),
    path('knowledge-paths/<int:pk>/nodes/', views.KnowledgePathNodesView.as_view(), name='knowledge_path_nodes'),
    path('nodes/<int:pk>/', views.NodeDetailView.as_view(), name='node_detail'),
    path('topics/', views.TopicView.as_view(), name='topics'),
    path('topics/<int:pk>/contents/', views.TopicContentsListView.as_view(), name='topic_contents_list'),
    path('upload-content/', views.UploadContentView.as_view(), name='upload_content'),
    path('user-content/', views.UserContentListView.as_view(), name='user_content_list'),
    path('content-profiles/<int:content_profile_id>/', views.ContentProfileView.as_view(), name='content-profile-detail'),
    path('topics/<int:pk>/', views.TopicDetailView.as_view(), name='topic-detail'),
    path('topics/<int:pk>/content/', views.TopicEditContentView.as_view(), name='topic-edit-content'),
    path('topics/<int:pk>/content/<str:media_type>/', views.TopicContentMediaTypeView.as_view(), name='topic-content-media-type'),
    # path('libraries/', LibraryList.as_view(), name='library-list'),
    # path('libraries/<int:pk>/', LibraryDetail.as_view(), name='library-detail'),
    # path('groups/', GroupList.as_view(), name='group-list'),
    # path('groups/<int:pk>/', GroupDetail.as_view(), name='group-detail'),
    # path('files/', FileList.as_view(), name='file-list'),
    # path('files/<int:pk>/', FileDetail.as_view(), name='file-detail'),
]
