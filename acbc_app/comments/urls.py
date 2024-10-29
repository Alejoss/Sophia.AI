from django.urls import path

from comments import views

app_name = "comments"

urlpatterns = [
    path("<int:pk>/", views.CommentView.as_view(), name="comment"),
    path("knowledge-path/<int:pk>/", views.KnowledgePathCommentsView.as_view(), name="knowledge_path_comments"),
    path("replies/knowledge-path/<int:pk>/", views.KnowledgePathCommentRepliesView.as_view(), name="knowledge_path_replies"),
    path("topic/<int:pk>/", views.TopicCommentsView.as_view(), name="topic_comments"),
    path("replies/topic/<int:pk>/", views.TopicCommentRepliesView.as_view(), name="topic_replies"),
    path("topic/<int:topic_pk>/content/<int:content_pk>/", views.ContentTopicCommentsView.as_view(), name="content_topic_comments"),
    path("replies/topic-content/<int:pk>/", views.ContentTopicCommentRepliesView.as_view(), name="content_topic_replies"),
]
