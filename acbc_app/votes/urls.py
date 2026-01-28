from django.urls import path
from . import views

app_name = 'votes'

urlpatterns = [
    # Content votes within topics
    path(
        'topics/<int:topic_pk>/contents/<int:content_pk>/vote/',
        views.ContentVoteView.as_view(),
        name='content-vote'
    ),
    # Knowledge path votes
    path(
        'knowledge-paths/<int:pk>/vote/',
        views.KnowledgePathVoteView.as_view(),
        name='knowledge-path-vote'
    ),
    # Comment votes
    path(
        'comments/<int:pk>/vote/',
        views.CommentVoteView.as_view(),
        name='comment-vote'
    ),
    # Publication votes
    path(
        'publications/<int:pk>/vote/',
        views.PublicationVoteView.as_view(),
        name='publication-vote'
    ),
    # Content suggestion votes
    path(
        'content-suggestions/<int:pk>/vote/',
        views.ContentSuggestionVoteView.as_view(),
        name='content-suggestion-vote'
    ),
]
