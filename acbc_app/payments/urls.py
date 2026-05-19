from django.urls import path

from payments import views

urlpatterns = [
    path('status/', views.PaymentGatewayStatusView.as_view(), name='payment-gateway-status'),
    path('ipn/', views.NOWPaymentsIPNView.as_view(), name='nowpayments-ipn'),
    path('registration/<int:registration_id>/', views.EventRegistrationPaymentView.as_view(), name='registration-payment-create'),
    path('registration/<int:registration_id>/list/', views.RegistrationPaymentsListView.as_view(), name='registration-payments-list'),
    path('<int:payment_id>/', views.CryptoPaymentDetailView.as_view(), name='crypto-payment-detail'),
]
