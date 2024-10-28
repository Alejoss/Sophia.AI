from django.urls import path

from content import views

app_name = "content"

urlpatterns = [
    path('libraries/', views.LibraryListView.as_view(), name='library_list'),
    path('libraries/<int:pk>/', views.LibraryDetailView.as_view(), name='library_detail'),
    path('collections/', views.CollectionListView.as_view(), name='collection_list'),
    path('collections/<int:pk>/', views.CollectionDetailView.as_view(), name='collection_detail'),
    path('contents/', views.ContentListView.as_view(), name='content_list'),
    path('contents/<int:pk>/', views.ContentDetailView.as_view(), name='content_detail'),
    path('knowledge-paths/', views.KnowledgePathListView.as_view(), name='knowledge_path_list'),
    path('knowledge-paths/<int:pk>/', views.KnowledgePathDetailView.as_view(), name='knowledge_path_detail'),
    path('nodes/<int:pk>/', views.NodeDetailView.as_view(), name='node_detail'),
    path('topics/', views.TopicListView.as_view(), name='topic_list'),
    path('topics/<int:pk>/contents/', views.TopicContentsListView.as_view(), name='topic_contents_list'),
    # path('libraries/', LibraryList.as_view(), name='library-list'),
    # path('libraries/<int:pk>/', LibraryDetail.as_view(), name='library-detail'),
    # path('groups/', GroupList.as_view(), name='group-list'),
    # path('groups/<int:pk>/', GroupDetail.as_view(), name='group-detail'),
    # path('files/', FileList.as_view(), name='file-list'),
    # path('files/<int:pk>/', FileDetail.as_view(), name='file-detail'),
]
