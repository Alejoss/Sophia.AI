from django.urls import path

from votes import views

app_name = 'votes'

urlpatterns = [
    path('knowledge-paths/<int:pk>/upvote/', views.KnowledgePathUpvoteView.as_view(), name='knowledge_path_upvote'),
    path('knowledge-paths/<int:pk>/downvote/', views.KnowledgePathDownvoteView.as_view(), name='knowledge_path_downvote'),
    path('topics/<int:topic_pk>/contents/<int:content_pk>/', views.ContentVoteTopicView.as_view(), name='content_vote_topic'),
    path('topics/<int:topic_pk>/contents/<int:content_pk>/upvote/', views.ContentUpvoteTopicView.as_view(), name='content_upvote_topic'),
    path('topics/<int:topic_pk>/contents/<int:content_pk>/downvote/', views.ContentDownvoteTopicView.as_view(), name='content_downvote_topic'),
]