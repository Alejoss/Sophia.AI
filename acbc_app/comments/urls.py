from django.urls import path

from comments import views

app_name = "comments"

urlpatterns = [
    path("<int:pk>/", views.CommentView.as_view(), name="comment"),
    path("knowledge-path/<int:pk>/", views.KnowledgePathCommentsView.as_view(), name="knowledge-path-comments"),
    path("replies/knowledge-path/<int:pk>/", views.KnowledgePathCommentRepliesView.as_view(), name="comment-replies"),
]
