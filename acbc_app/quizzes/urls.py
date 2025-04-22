from django.urls import path
from . import views
from .views import QuizzesByKnowledgePathView, QuizSubmitView

app_name = 'quizzes'

urlpatterns = [
    path('quiz-create/', views.QuizCreateView.as_view(), name='quiz-create'),
    path('quiz-detail/<int:pk>/', views.QuizDetailView.as_view(), name='quiz-detail'),
    path('knowledge-paths/<int:path_id>/quizzes/', QuizzesByKnowledgePathView.as_view(), name='quizzes-by-knowledge-path'),
    path('quiz/<int:quiz_id>/submit/', QuizSubmitView.as_view(), name='quiz-submit'),
] 