from django.urls import path

from comments import views

app_name = "comments"

urlpatterns = [
    path("<int:pk>/", views.CommentView.as_view(), name="comment"),
    path("replies/<int:pk>/", views.CommentRepliesView.as_view(), name="comment_replies"),
    path("knowledge-path/<int:pk>/", views.KnowledgePathCommentsView.as_view(), name="knowledge_path_comments"),
    path("topic/<int:pk>/", views.TopicCommentsView.as_view(), name="topic_comments"),
    path("topic/<int:topic_pk>/content/<int:content_pk>/", views.ContentTopicCommentsView.as_view(), name="content_topic_comments"),
]
