from django.urls import path

from book_clubs import views

app_name = 'book_clubs'

urlpatterns = [
    path('', views.BookClubListCreateView.as_view(), name='book-club-list'),
    path('<slug:slug>/', views.BookClubDetailView.as_view(), name='book-club-detail'),
    path('<slug:slug>/join/', views.BookClubJoinView.as_view(), name='book-club-join'),
    path('<slug:slug>/hub/', views.BookClubHubView.as_view(), name='book-club-hub'),
    path('<slug:slug>/events/', views.BookClubEventListCreateView.as_view(), name='book-club-events'),
    path(
        '<slug:slug>/discussion-questions/',
        views.DiscussionQuestionListCreateView.as_view(),
        name='discussion-question-list',
    ),
    path(
        '<slug:slug>/discussion-questions/<int:pk>/',
        views.DiscussionQuestionDetailView.as_view(),
        name='discussion-question-detail',
    ),
]
