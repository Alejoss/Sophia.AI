from django.urls import path
from . import views

app_name = 'comments'

urlpatterns = [
    path('', views.CommentView.as_view(), name='comment-list'),
    path('<int:pk>/', views.CommentView.as_view(), name='comment-detail'),
    path('replies/<int:pk>/', views.CommentRepliesView.as_view(), name='comment_replies'),
    path('knowledge-path/<int:pk>/', views.KnowledgePathCommentsView.as_view(), name='knowledge_path_comments'),
    path('topic/<int:pk>/', views.TopicCommentsView.as_view(), name='topic_comments'),
    path('topic/<int:topic_pk>/content/<int:content_pk>/', views.ContentTopicCommentsView.as_view(), name='content_topic_comments'),
]
