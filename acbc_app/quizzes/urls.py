from django.urls import path
from . import views

app_name = 'quizzes'

urlpatterns = [
    path('quizzes/', views.QuizCreateView.as_view(), name='quiz-create'),
    path('quizzes/<int:pk>/', views.QuizDetailView.as_view(), name='quiz-detail'),
] 