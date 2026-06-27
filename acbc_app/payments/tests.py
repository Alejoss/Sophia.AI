import hashlib
import hmac
import json

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from payments.models import CryptoPayment
from payments.nowpayments_client import NOWPaymentsClient
from payments.services import sync_payment_from_provider
from utils.db_encoding import to_ascii_safe, to_ascii_safe_json
from tests.factories.events import EventFactory, EventRegistrationFactory
from tests.factories.users import UserFactory


class NOWPaymentsIPNSignatureTests(TestCase):
    def test_verify_ipn_signature_sorted_body(self):
        secret = 'test-ipn-secret'
        body = {
            'payment_id': 123,
            'payment_status': 'finished',
            'order_id': 'evt-reg-1-abc',
            'pay_amount': '0.01',
            'actually_paid': '0.01',
        }
        client = NOWPaymentsClient()
        client.ipn_secret = secret
        sorted_body = json.dumps(
            client.sort_params(body),
            separators=(',', ':'),
            ensure_ascii=True,
        )
        signature = hmac.new(
            secret.encode('utf-8'),
            sorted_body.encode('utf-8'),
            hashlib.sha512,
        ).hexdigest()
        self.assertTrue(client.verify_ipn_signature(body, signature))


class SyncPaymentFromProviderTests(TestCase):
    def setUp(self):
        self.event = EventFactory(reference_price=50.0)
        self.registration = EventRegistrationFactory(
            event=self.event,
            payment_status='PENDING',
        )
        self.crypto_payment = CryptoPayment.objects.create(
            registration=self.registration,
            order_id='evt-reg-test-order',
            pay_currency='bch',
            price_amount=50.0,
            pay_amount='0.05',
            pay_address='bitcoincash:qptest',
            payment_status='waiting',
        )

    def test_confirmed_does_not_mark_registration_paid(self):
        sync_payment_from_provider(self.crypto_payment, {
            'payment_status': 'confirmed',
            'actually_paid': '0.05',
            'pay_amount': '0.05',
        })
        self.registration.refresh_from_db()
        self.assertEqual(self.registration.payment_status, 'PENDING')
        self.crypto_payment.refresh_from_db()
        self.assertEqual(self.crypto_payment.payment_status, 'confirmed')

    def test_finished_marks_registration_paid(self):
        sync_payment_from_provider(self.crypto_payment, {
            'payment_status': 'finished',
            'actually_paid': '0.05',
            'pay_amount': '0.05',
        })
        self.registration.refresh_from_db()
        self.assertEqual(self.registration.payment_status, 'PAID')

    def test_finished_idempotent(self):
        payload = {
            'payment_status': 'finished',
            'actually_paid': '0.05',
            'pay_amount': '0.05',
        }
        sync_payment_from_provider(self.crypto_payment, payload)
        sync_payment_from_provider(self.crypto_payment, payload)
        self.registration.refresh_from_db()
        self.assertEqual(self.registration.payment_status, 'PAID')

    def test_finished_with_insufficient_actually_paid(self):
        sync_payment_from_provider(self.crypto_payment, {
            'payment_status': 'finished',
            'actually_paid': '0.01',
            'pay_amount': '0.05',
        })
        self.registration.refresh_from_db()
        self.assertEqual(self.registration.payment_status, 'PENDING')


class IPNLookupTests(TestCase):
    def setUp(self):
        self.event = EventFactory(reference_price=50.0)
        self.registration = EventRegistrationFactory(
            event=self.event,
            payment_status='PENDING',
        )
        self.crypto_payment = CryptoPayment.objects.create(
            registration=self.registration,
            order_id='evt-reg-invoice-order',
            nowpayments_payment_id=999888777,
            pay_currency='',
            price_amount=50.0,
            payment_status='waiting',
            invoice_url='https://nowpayments.io/payment/?iid=999888777',
        )

    def test_ipn_finds_payment_by_order_id(self):
        from payments.views import _find_crypto_payment_for_ipn

        found = _find_crypto_payment_for_ipn({
            'order_id': 'evt-reg-invoice-order',
            'payment_status': 'waiting',
        })
        self.assertEqual(found.id, self.crypto_payment.id)

    def test_ipn_finds_payment_by_invoice_id(self):
        from payments.views import _find_crypto_payment_for_ipn

        found = _find_crypto_payment_for_ipn({
            'invoice_id': 999888777,
            'payment_id': 12345,
            'payment_status': 'finished',
            'actually_paid': '50',
            'pay_amount': '50',
        })
        self.assertEqual(found.id, self.crypto_payment.id)


@override_settings(NOWPAYMENTS_API_KEY='test-key')
class AcceptPaymentGatewayTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.event_owner = UserFactory()
        self.participant = UserFactory()
        self.event = EventFactory(owner=self.event_owner, reference_price=25.0)
        self.registration = EventRegistrationFactory(
            user=self.participant,
            event=self.event,
            payment_status='PENDING',
        )
        self.url = reverse('events:participant-status', kwargs={
            'event_id': self.event.pk,
            'registration_id': self.registration.pk,
        })

    def test_accept_payment_blocked_when_gateway_configured(self):
        self.client.force_authenticate(user=self.event_owner)
        response = self.client.patch(self.url, {'action': 'accept_payment'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.registration.refresh_from_db()
        self.assertEqual(self.registration.payment_status, 'PENDING')


@override_settings(NOWPAYMENTS_API_KEY='')
class PaymentGatewayStatusTests(TestCase):
    def test_status_endpoint(self):
        client = APIClient()
        response = client.get(reverse('payment-gateway-status'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['enabled'])
        self.assertIn('bch', response.data['currencies'])


class AsciiSafeStorageTests(TestCase):
    def test_to_ascii_safe_strips_accents(self):
        self.assertEqual(to_ascii_safe('Filosofía Cypherpunk'), 'Filosofia Cypherpunk')

    def test_to_ascii_safe_json_strips_unicode_in_dict(self):
        payload = {'order_description': 'Registro: Filosofía'}
        safe = to_ascii_safe_json(payload)
        self.assertEqual(safe['order_description'], 'Registro: Filosofia')
