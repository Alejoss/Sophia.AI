from django.urls import path

from book_clubs import views

app_name = 'book_clubs'

urlpatterns = [
    path('', views.BookClubListCreateView.as_view(), name='book-club-list'),
    path('invite-preview/', views.BookClubInvitePreviewView.as_view(), name='invite-preview'),
    path('<slug:slug>/', views.BookClubDetailView.as_view(), name='book-club-detail'),
    path('<slug:slug>/guest-access/', views.BookClubGuestAccessView.as_view(), name='book-club-guest-access'),
    path('<slug:slug>/join/', views.BookClubJoinView.as_view(), name='book-club-join'),
    path(
        '<slug:slug>/membership/introduction/',
        views.BookClubMemberIntroductionView.as_view(),
        name='book-club-member-introduction',
    ),
    path(
        '<slug:slug>/members/',
        views.BookClubMemberListView.as_view(),
        name='book-club-members',
    ),
    path('<slug:slug>/hub/', views.BookClubHubView.as_view(), name='book-club-hub'),
    path('<slug:slug>/events/', views.BookClubEventListCreateView.as_view(), name='book-club-events'),
    path(
        '<slug:slug>/events/<int:pk>/',
        views.BookClubEventUnlinkView.as_view(),
        name='book-club-event-unlink',
    ),
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
