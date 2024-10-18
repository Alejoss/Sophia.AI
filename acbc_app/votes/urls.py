from django.urls import path

from votes.views import KnowledgePathVoteView, KnowledgePathUpvoteView, KnowledgePathDownvoteView

app_name = 'votes'

urlpatterns = [
    path('knowledge-paths/<int:pk>/', KnowledgePathVoteView.as_view(), name='knowledge_path_vote'),
    path('knowledge-paths/<int:pk>/upvote/', KnowledgePathUpvoteView.as_view(), name='knowledge_path_upvote'),
    path('knowledge-paths/<int:pk>/downvote/', KnowledgePathDownvoteView.as_view(), name='knowledge_path_downvote'),
]