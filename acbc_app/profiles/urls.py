from django.urls import path, include
from django.contrib.auth import views as auth_views
from profiles import views

app_name = 'profiles'

urlpatterns = [
    path('check_auth/', views.CheckAuth.as_view(), name='check_auth'),
    path('user_profile/', views.UserProfileView.as_view(), name='user_profile'),
    path('', views.ProfileList.as_view(), name='profile-list'),
    path('<int:pk>/', views.ProfileDetail.as_view(), name='profile-detail'),

    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),

    path('<int:pk>/', views.UserDetailView.as_view(), name='file-detail'),
    path('activate_account/', views.activate_account, name="activate_account"),

    path('set_jwt_token/', views.set_jwt_token, name="set_jwt_token"),
    path('get_csrf_token/', views.GetCsrfToken.as_view(), name='get_csrf_token'),
    path('refresh_token/', views.RefreshTokenView.as_view(), name='refresh_token'),
]
