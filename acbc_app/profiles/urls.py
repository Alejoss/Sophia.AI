from django.urls import path
from django.contrib.auth import views as auth_views
from profiles import views

urlpatterns = [
    # path('profile_data/', views.profile_data, name="profile_data"),
    # path('user_profile/<int:profile_id>', views.user_profile, name="user_profile"),
    # path('profile_security/', views.profile_security, name="profile_security"),
    # path('profile_events/', views.profile_events, name="profile_events"),
    # path('profile_certificates/', views.profile_certificates, name="profile_certificates"),
    # path('profile_content/', views.profile_content, name="profile_content"),
    # path('profile_activate/<str:uid>/<str:token>/', views.activate_account, name="activate_account"),
    # path('test_unstoppable_domains/', views.test_unstoppable_domains, name="test_unstoppable_domains"),

    # path('profile_edit_picture/', views.profile_edit_picture, name="profile_edit_picture"),
    # path('profile_edit_contactm/', views.profile_edit_contact_method, name="profile_edit_contactm"),
    # path('profile_edit_cryptos/', views.profile_edit_cryptos, name="profile_edit_cryptos"),
    # path('profile_delete_contactm/', views.profile_delete_contact_method, name="profile_delete_contactm"),
    # path('profile_delete_crypto/', views.profile_delete_crypto, name="profile_delete_crypto"),
    # path('profile_bookmarks/', views.profile_bookmarks, name="profile_bookmarks"),
    # path('profile_cert_requests/', views.profile_cert_requests, name="profile_cert_requests"),
    # path('content/', views.content, name="content"),  # Proximamente

    # account management
    # path('register/', views.register_profile, name="profile_register"),
    # path('login/', views.AcademiaLogin.as_view(), name="login"),
    path('set_jwt_token/', views.set_jwt_token, name="set_jwt_token"),
    path('activate_account/', views.activate_account, name="activate_account"),
    # path('logout/', auth_views.LogoutView.as_view(), name="logout"),
    # path('password_reset/', views.AcademiaPasswordResetView.as_view(), name="password_reset"),
    # path('password_reset_done/', views.AcademiaPasswordResetDoneView.as_view(), name="password_reset_done"),
    # path('password_reset_confirm/<uidb64>/<token>/', views.AcademiaPasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    # path('password_reset_complete/', views.AcademiaPasswordResetCompleteView.as_view(), name="password_reset_complete"),
    # path('resend_activation_email/', views.resend_activation_email, name="resend_activation_email")
]
