from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PublicationListView,
    PublicationDetailView,
    PublicationVoteView,
    LibraryListView,
    LibraryDetailView,
    UserCollectionsView,
    CollectionContentView,
    ContentListView,
    ContentDetailView,
    KnowledgePathListView,
    KnowledgePathDetailView,
    KnowledgePathNodesView,
    NodeDetailView,
    TopicView,
    TopicDetailView,
    TopicBasicView,
    UploadContentView,
    UserContentListView,
    ContentProfileView,
    TopicEditContentView,
    TopicContentMediaTypeView,
    RecentUserContentView,
    UserContentByIdView,
    ContentReferencesView
)

app_name = "content"

urlpatterns = [
    # Publication URLs
    path('publications/', PublicationListView.as_view(), name='publication-list'),
    path('publications/<int:pk>/', PublicationDetailView.as_view(), name='publication-detail'),
    path('publications/<int:pk>/vote/', PublicationVoteView.as_view(), name='publication-vote'),
    
    # Existing URLs
    path('libraries/', LibraryListView.as_view(), name='library_list'),
    path('libraries/<int:pk>/', LibraryDetailView.as_view(), name='library_detail'),
    path('collections/', UserCollectionsView.as_view(), name='user-collections'),
    path('collections/<int:collection_id>/content/', CollectionContentView.as_view(), name='collection-content'),
    path('contents/', ContentListView.as_view(), name='content_list'),
    path('content_details/<int:pk>/', ContentDetailView.as_view(), name='content-detail'),
    path('knowledge-paths/', KnowledgePathListView.as_view(), name='knowledge_path_list'),
    path('knowledge-paths/<int:pk>/', KnowledgePathDetailView.as_view(), name='knowledge_path_detail'),
    path('knowledge-paths/<int:pk>/nodes/', KnowledgePathNodesView.as_view(), name='knowledge_path_nodes'),
    path('nodes/<int:pk>/', NodeDetailView.as_view(), name='node_detail'),
    path('topics/', TopicView.as_view(), name='topics'),
    path('topics/<int:pk>/', TopicDetailView.as_view(), name='topic-detail'),
    path('topics/<int:pk>/basic/', TopicBasicView.as_view(), name='topic-basic'),
    path('upload-content/', UploadContentView.as_view(), name='upload_content'),
    path('user-content/', UserContentListView.as_view(), name='user-content'),
    path('user-content/<int:user_id>/', UserContentByIdView.as_view(), name='user-content-by-id'),
    path('content-profiles/<int:content_profile_id>/', ContentProfileView.as_view(), name='content-profile-detail'),
    path('topics/<int:pk>/content/', TopicEditContentView.as_view(), name='topic-edit-content'),
    path('topics/<int:pk>/content/<str:media_type>/', TopicContentMediaTypeView.as_view(), name='topic-content-media-type'),
    path('recent-user-content/', RecentUserContentView.as_view(), name='recent-user-content'),
    path('references/<int:pk>/', ContentReferencesView.as_view(), name='content-references'),
    # path('libraries/', LibraryList.as_view(), name='library-list'),
    # path('libraries/<int:pk>/', LibraryDetail.as_view(), name='library-detail'),
    # path('groups/', GroupList.as_view(), name='group-list'),
    # path('groups/<int:pk>/', GroupDetail.as_view(), name='group-detail'),
    # path('files/', FileList.as_view(), name='file-list'),
    # path('files/<int:pk>/', FileDetail.as_view(), name='file-detail'),
]
