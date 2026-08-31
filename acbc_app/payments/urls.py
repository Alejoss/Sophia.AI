from django.urls import path

from payments import views

urlpatterns = [
    path('status/', views.PaymentGatewayStatusView.as_view(), name='payment-gateway-status'),
    path('ipn/', views.NOWPaymentsIPNView.as_view(), name='nowpayments-ipn'),
    path('registration/<int:registration_id>/', views.EventRegistrationPaymentView.as_view(), name='registration-payment-create'),
    path('registration/<int:registration_id>/list/', views.RegistrationPaymentsListView.as_view(), name='registration-payments-list'),
    path('path-purchase/<int:purchase_id>/', views.PathPurchasePaymentView.as_view(), name='path-purchase-payment-create'),
    path('path-purchase/<int:purchase_id>/list/', views.PathPurchasePaymentsListView.as_view(), name='path-purchase-payments-list'),
    path('anchor-request/<int:request_id>/', views.AnchorRequestPaymentView.as_view(), name='anchor-request-payment-create'),
    path('anchor-request/<int:request_id>/list/', views.AnchorRequestPaymentsListView.as_view(), name='anchor-request-payments-list'),
    path('anchor-request/<int:request_id>/bch/', views.AnchorRequestBchPaymentView.as_view(), name='anchor-request-bch'),
    path('anchor-request/<int:request_id>/bch/verify/', views.AnchorRequestBchVerifyView.as_view(), name='anchor-request-bch-verify'),
    path('<int:payment_id>/', views.CryptoPaymentDetailView.as_view(), name='crypto-payment-detail'),
]
