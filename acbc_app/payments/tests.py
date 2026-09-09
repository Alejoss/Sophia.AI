import hashlib
import hmac
import json
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from content.models import Content, ContentTranscript, TranscriptAnchorRequest
from knowledge_paths.models import KnowledgePath, KnowledgePathPurchase, Node
from payments.bch_client import BchApiError, BchTransaction, BchTxOutput
from payments.bch_services import (
    BchPaymentError,
    create_or_reuse_bch_payment,
    get_bch_payment_product_meta,
    verify_bch_payment,
)
from payments.models import BchDirectPayment, CryptoPayment, TokenLedgerEntry, TokenPackage
from payments.nowpayments_client import NOWPaymentsClient, NOWPaymentsError
from payments.services import (
    create_anchor_request_payment,
    create_path_purchase_payment,
    create_token_purchase,
    create_token_purchase_payment,
    fetch_remote_payment_payload,
    get_or_create_path_purchase,
    refresh_crypto_payment_from_nowpayments,
    sync_payment_from_provider,
)
from payments.text_utils import to_ascii_safe, to_ascii_safe_json
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
            event_registration=self.registration,
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


class PathPurchasePaymentFulfillmentTests(TestCase):
    def setUp(self):
        self.author = UserFactory()
        self.buyer = UserFactory()
        self.path = KnowledgePath.objects.create(
            title='Paid Path',
            author=self.author,
            is_visible=True,
            reference_price=20.0,
        )
        Node.objects.create(
            knowledge_path=self.path,
            title='Node 1',
            media_type='TEXT',
            order=1,
        )
        self.purchase = KnowledgePathPurchase.objects.create(
            user=self.buyer,
            knowledge_path=self.path,
            payment_status='PENDING',
            price_amount=20.0,
        )
        self.crypto_payment = CryptoPayment.objects.create(
            path_purchase=self.purchase,
            order_id='kp-purchase-test-order',
            pay_currency='bch',
            price_amount=20.0,
            pay_amount='0.02',
            pay_address='bitcoincash:qtest',
            payment_status='waiting',
        )

    def test_finished_marks_path_purchase_paid(self):
        sync_payment_from_provider(self.crypto_payment, {
            'payment_status': 'finished',
            'actually_paid': '0.02',
            'pay_amount': '0.02',
        })
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.payment_status, 'PAID')

    def test_confirmed_does_not_unlock_path(self):
        sync_payment_from_provider(self.crypto_payment, {
            'payment_status': 'confirmed',
            'actually_paid': '0.02',
            'pay_amount': '0.02',
        })
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.payment_status, 'PENDING')


class IPNLookupTests(TestCase):
    def setUp(self):
        self.event = EventFactory(reference_price=50.0)
        self.registration = EventRegistrationFactory(
            event=self.event,
            payment_status='PENDING',
        )
        self.crypto_payment = CryptoPayment.objects.create(
            event_registration=self.registration,
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

    def test_ipn_finds_payment_by_payment_id_in_provider_payload(self):
        from payments.views import _find_crypto_payment_for_ipn

        self.crypto_payment.nowpayments_payment_id = 555444333
        self.crypto_payment.provider_payload = {
            'invoice_id': 999888777,
            'payment_id': 12345,
        }
        self.crypto_payment.save(update_fields=['nowpayments_payment_id', 'provider_payload'])

        found = _find_crypto_payment_for_ipn({
            'payment_id': 12345,
            'payment_status': 'finished',
            'actually_paid': '50',
            'pay_amount': '50',
        })
        self.assertEqual(found.id, self.crypto_payment.id)


class InvoicePaymentSyncTests(TestCase):
    def setUp(self):
        self.event = EventFactory(reference_price=5.0)
        self.registration = EventRegistrationFactory(
            event=self.event,
            payment_status='PENDING',
        )
        self.crypto_payment = CryptoPayment.objects.create(
            event_registration=self.registration,
            order_id='evt-reg-invoice-sync',
            nowpayments_payment_id=999888777,
            pay_currency='',
            price_amount=5.0,
            payment_status='waiting',
            invoice_url='https://nowpayments.io/payment/?iid=999888777',
            provider_payload={'id': 999888777, 'invoice_id': 999888777},
        )

    @patch.object(NOWPaymentsClient, 'get_invoice_payment')
    def test_fetch_remote_payment_payload_uses_invoice_lookup(self, mock_get_invoice_payment):
        mock_get_invoice_payment.return_value = {
            'payment_id': 12345,
            'payment_status': 'finished',
            'actually_paid': '5',
            'pay_amount': '5',
            'pay_currency': 'bch',
        }
        client = NOWPaymentsClient()
        payload = fetch_remote_payment_payload(client, self.crypto_payment)
        self.assertEqual(payload['payment_id'], 12345)
        mock_get_invoice_payment.assert_called_once_with(999888777)

    @override_settings(NOWPAYMENTS_API_KEY='test-key')
    @patch('payments.services.NOWPaymentsClient.get_invoice_payment')
    def test_refresh_crypto_payment_marks_registration_paid(self, mock_get_invoice_payment):
        mock_get_invoice_payment.return_value = {
            'payment_id': 12345,
            'payment_status': 'finished',
            'actually_paid': '5',
            'pay_amount': '5',
            'pay_currency': 'bch',
        }
        refresh_crypto_payment_from_nowpayments(self.crypto_payment)
        self.registration.refresh_from_db()
        self.crypto_payment.refresh_from_db()
        self.assertEqual(self.registration.payment_status, 'PAID')
        self.assertEqual(self.crypto_payment.payment_status, 'finished')
        self.assertEqual(self.crypto_payment.nowpayments_payment_id, 12345)
        self.assertEqual(self.crypto_payment.provider_payload.get('invoice_id'), 999888777)


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
        self.assertIn('bch_network', response.data)


@override_settings(NOWPAYMENTS_API_KEY='test-key')
class PathPurchaseApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.author = UserFactory()
        self.buyer = UserFactory()
        self.path = KnowledgePath.objects.create(
            title='Crypto Path',
            author=self.author,
            is_visible=True,
            reference_price=15.0,
        )
        self.node = Node.objects.create(
            knowledge_path=self.path,
            title='Intro',
            media_type='TEXT',
            order=1,
        )

    def test_purchase_creates_pending_entitlement(self):
        self.client.force_authenticate(user=self.buyer)
        response = self.client.post(f'/api/knowledge_paths/{self.path.id}/purchase/')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['payment_status'], 'PENDING')
        self.assertEqual(response.data['price_amount'], 15.0)

    def test_node_blocked_until_paid(self):
        self.client.force_authenticate(user=self.buyer)
        response = self.client.get(
            f'/api/knowledge_paths/{self.path.id}/nodes/{self.node.id}/'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'path_payment_required')

        purchase = get_or_create_path_purchase(knowledge_path=self.path, user=self.buyer)
        purchase.payment_status = 'PAID'
        purchase.save(update_fields=['payment_status'])

        response = self.client.get(
            f'/api/knowledge_paths/{self.path.id}/nodes/{self.node.id}/'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('payments.services.NOWPaymentsClient.create_invoice')
    def test_create_path_purchase_payment_invoice(self, mock_create_invoice):
        mock_create_invoice.return_value = {
            'id': 777,
            'invoice_url': 'https://nowpayments.io/payment/?iid=777',
        }
        purchase = get_or_create_path_purchase(knowledge_path=self.path, user=self.buyer)
        payment = create_path_purchase_payment(path_purchase=purchase, user=self.buyer)
        self.assertEqual(payment.path_purchase_id, purchase.id)
        self.assertIsNone(payment.event_registration_id)
        self.assertTrue(payment.invoice_url)
        self.assertTrue(payment.order_id.startswith('kp-purchase-'))


class AsciiSafeStorageTests(TestCase):
    def test_to_ascii_safe_strips_accents(self):
        self.assertEqual(to_ascii_safe('Filosofía Cypherpunk'), 'Filosofia Cypherpunk')

    def test_to_ascii_safe_json_strips_unicode(self):
        payload = {'order_description': 'Registro: Filosofía'}
        safe = to_ascii_safe_json(payload)
        self.assertEqual(safe['order_description'], 'Registro: Filosofia')
        raw = json.dumps(safe, ensure_ascii=True)
        self.assertNotIn('í', raw)


@override_settings(ANCHOR_REQUEST_PRICE_USD=1)
class AnchorRequestPaymentFulfillmentTests(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='VIDEO',
            original_title='Video anclar',
        )
        self.transcript = ContentTranscript.objects.create(
            content=self.content,
            processed_plain='Texto para solicitud de anclaje.',
            language='es',
        )
        self.req = TranscriptAnchorRequest.objects.create(
            requester=self.user,
            content=self.content,
            text_hash=self.transcript.text_hash,
            text_length=self.transcript.text_length,
            price_amount=1.0,
            status=TranscriptAnchorRequest.STATUS_PENDING_PAYMENT,
        )
        self.crypto_payment = CryptoPayment.objects.create(
            anchor_request=self.req,
            order_id='anchor-req-test-order',
            pay_currency='bch',
            price_amount=1.0,
            pay_amount='0.001',
            pay_address='bitcoincash:qtest',
            payment_status='waiting',
        )

    def test_finished_marks_paid_pending_review(self):
        sync_payment_from_provider(self.crypto_payment, {
            'payment_status': 'finished',
            'actually_paid': '0.001',
            'pay_amount': '0.001',
        })
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, TranscriptAnchorRequest.STATUS_PAID_PENDING_REVIEW)

    def test_confirmed_does_not_advance_request(self):
        sync_payment_from_provider(self.crypto_payment, {
            'payment_status': 'confirmed',
            'actually_paid': '0.001',
            'pay_amount': '0.001',
        })
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, TranscriptAnchorRequest.STATUS_PENDING_PAYMENT)

    @override_settings(NOWPAYMENTS_API_KEY='test-key')
    @patch('payments.services.NOWPaymentsClient.create_invoice')
    def test_create_anchor_request_payment_invoice(self, mock_create_invoice):
        mock_create_invoice.return_value = {
            'id': 888,
            'invoice_url': 'https://nowpayments.io/payment/?iid=888',
        }
        # Fresh request without existing crypto payment open
        req = TranscriptAnchorRequest.objects.create(
            requester=self.user,
            content=self.content,
            text_hash='ab' * 32,
            text_length=10,
            price_amount=1.0,
        )
        payment = create_anchor_request_payment(anchor_request=req, user=self.user)
        self.assertEqual(payment.anchor_request_id, req.id)
        self.assertIsNone(payment.path_purchase_id)
        self.assertTrue(payment.order_id.startswith('anchor-req-'))


@override_settings(
    ANCHOR_REQUEST_PRICE_USD=1,
    BCH_NETWORK='mainnet',
    BCH_RECEIVE_ADDRESS='bitcoincash:qqqqzqsrqszsvpcgpy9qkrqdpc83qygjzvcnueldtz',
    BCH_USD_PRICE=200,
    BCH_MIN_CONFIRMATIONS=0,
    BCH_PAYMENT_TTL_MINUTES=30,
)
class BchDirectPaymentTests(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='VIDEO',
            original_title='Video BCH',
        )
        self.transcript = ContentTranscript.objects.create(
            content=self.content,
            processed_plain='Texto para BCH directo.',
            language='es',
        )
        self.req = TranscriptAnchorRequest.objects.create(
            requester=self.user,
            content=self.content,
            text_hash=self.transcript.text_hash,
            text_length=self.transcript.text_length,
            price_amount=1.0,
            status=TranscriptAnchorRequest.STATUS_PENDING_PAYMENT,
        )

    def test_create_bch_order_unique_sats(self):
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        payment = create_or_reuse_bch_payment(
            anchor_request=self.req,
            user=self.user,
            client=client,
        )
        self.assertEqual(payment.status, BchDirectPayment.STATUS_PENDING)
        self.assertEqual(payment.expected_amount_sats, 500000)  # 1/200 BCH
        self.assertTrue(payment.address.startswith('bitcoincash:'))
        self.assertEqual((payment.provider_payload or {}).get('network'), 'mainnet')

        reused = create_or_reuse_bch_payment(
            anchor_request=self.req,
            user=self.user,
            client=client,
        )
        self.assertEqual(reused.pk, payment.pk)

    def test_verify_marks_request_paid_pending_review(self):
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            anchor_request=self.req,
            user=self.user,
            client=client,
        )
        txid = 'ab' * 32
        client.get_transaction.return_value = BchTransaction(
            txid=txid,
            timestamp=int(order.created_at.timestamp()) + 10,
            confirmations=1,
            outputs=[
                BchTxOutput(
                    address=order.address,
                    amount_sats=order.expected_amount_sats,
                ),
            ],
        )
        paid = verify_bch_payment(
            anchor_request=self.req,
            user=self.user,
            payment_txid=txid,
            client=client,
        )
        self.assertEqual(paid.status, BchDirectPayment.STATUS_PAID)
        self.assertEqual(paid.payment_txid, txid)
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, TranscriptAnchorRequest.STATUS_PAID_PENDING_REVIEW)

    def test_verify_amount_outside_usd_tolerance_fails(self):
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            anchor_request=self.req,
            user=self.user,
            client=client,
        )
        # At $200/BCH, $0.20 tolerance ≈ 100_000 sats — stay outside that window.
        txid = 'cd' * 32
        client.get_transaction.return_value = BchTransaction(
            txid=txid,
            timestamp=int(order.created_at.timestamp()) + 10,
            confirmations=1,
            outputs=[
                BchTxOutput(
                    address=order.address,
                    amount_sats=order.expected_amount_sats + 150_000,
                ),
            ],
        )
        with self.assertRaises(BchPaymentError):
            verify_bch_payment(
                anchor_request=self.req,
                user=self.user,
                payment_txid=txid,
                client=client,
            )
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, TranscriptAnchorRequest.STATUS_PENDING_PAYMENT)

    def test_verify_accepts_amount_within_usd_tolerance(self):
        """Prod regression: wallet sent 1161215 vs expected 1162656 (~$0.004)."""
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            anchor_request=self.req,
            user=self.user,
            client=client,
        )
        paid_sats = order.expected_amount_sats - 1441
        txid = 'c4' * 32
        client.get_transaction.return_value = BchTransaction(
            txid=txid,
            timestamp=int(order.created_at.timestamp()) + 10,
            confirmations=1,
            outputs=[
                BchTxOutput(address=order.address, amount_sats=paid_sats),
            ],
        )
        paid = verify_bch_payment(
            anchor_request=self.req,
            user=self.user,
            payment_txid=txid,
            client=client,
        )
        self.assertEqual(paid.status, BchDirectPayment.STATUS_PAID)
        self.assertEqual(paid.payment_txid, txid)
        self.assertEqual(paid.provider_payload.get('amount_sats'), paid_sats)
        self.assertEqual(paid.provider_payload.get('amount_delta_sats'), -1441)

    def test_verify_real_txid_4fd39e0a_amount_within_tolerance(self):
        """
        Live prod payment 2026-09-09: TX 4fd39e0a… sent 1_938_661 sats to the
        shared receive address. Exact-match verify failed; ±$0.20 must accept it.
        """
        receive = 'bitcoincash:qpnq74gum4tstjat4803zav9lr37v5wqaqyqrh9wjd'
        paid_sats = 1_938_661
        # Reconstruct a realistic expected amount (~$5 at ~$257/BCH, ceil).
        rate = Decimal('256.98')
        expected = 1_945_676  # ceil(5 / 256.98 * 1e8)
        self.assertLess(abs(paid_sats - expected), 80_000)  # well under $0.20

        with self.settings(BCH_RECEIVE_ADDRESS=receive, BCH_USD_PRICE=rate):
            client = MagicMock()
            client.get_bch_usd_rate.return_value = rate
            # Force the expected sats the order would have shown.
            from payments.models import BchDirectPayment as BchModel
            from django.utils import timezone
            from datetime import timedelta

            order = BchModel.objects.create(
                anchor_request=self.req,
                address=receive,
                expected_amount_sats=expected,
                usd_amount=Decimal('5.00'),
                usd_bch_rate=rate,
                status=BchModel.STATUS_PENDING,
                expires_at=timezone.now() + timedelta(minutes=30),
                provider_payload={'network': 'mainnet'},
            )
            txid = '4fd39e0a8c7836b7b10be30fcd213d21e2ed9a1fedd16dc8da77ca200e328d7a'
            client.get_transaction.return_value = BchTransaction(
                txid=txid,
                timestamp=int(order.created_at.timestamp()) + 60,
                confirmations=0,
                outputs=[
                    BchTxOutput(
                        address='bitcoincash:qzqna5s34njc3exw6l3u6jm8wzkd0l324sa6ytrkgl',
                        amount_sats=12_757_089,
                    ),
                    BchTxOutput(address=receive, amount_sats=paid_sats),
                ],
            )
            paid = verify_bch_payment(
                anchor_request=self.req,
                user=self.user,
                payment_txid=txid,
                client=client,
            )
            self.assertEqual(paid.pk, order.pk)
            self.assertEqual(paid.status, BchModel.STATUS_PAID)
            self.assertEqual(
                paid.payment_txid,
                '4fd39e0a8c7836b7b10be30fcd213d21e2ed9a1fedd16dc8da77ca200e328d7a',
            )
            self.assertEqual(paid.provider_payload.get('amount_sats'), paid_sats)

    def test_verify_mismatch_attaches_diagnostic_details(self):
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            anchor_request=self.req,
            user=self.user,
            client=client,
        )
        txid = 'ee' * 32
        client.get_transaction.return_value = BchTransaction(
            txid=txid,
            timestamp=int(order.created_at.timestamp()) + 10,
            confirmations=1,
            outputs=[
                BchTxOutput(
                    address=order.address,
                    amount_sats=order.expected_amount_sats + 250_000,
                ),
            ],
        )
        with self.assertRaises(BchPaymentError) as ctx:
            verify_bch_payment(
                anchor_request=self.req,
                user=self.user,
                payment_txid=txid,
                client=client,
            )
        details = ctx.exception.details
        self.assertEqual(details.get('expected_sats'), order.expected_amount_sats)
        self.assertIn(order.expected_amount_sats + 250_000, details.get('amounts_seen') or [])
        self.assertEqual(details.get('txs_scanned'), 1)

    def test_allocate_unique_sats_spaces_by_tolerance_window(self):
        from payments.bch_services import _allocate_unique_sats, _unique_sats_step

        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        first = create_or_reuse_bch_payment(
            anchor_request=self.req,
            user=self.user,
            client=client,
        )
        step = _unique_sats_step(Decimal('200'))
        second_sats = _allocate_unique_sats(first.expected_amount_sats, rate=Decimal('200'))
        self.assertGreaterEqual(second_sats - first.expected_amount_sats, step)

    def test_verify_accepts_tx_with_blocktime_before_order_within_grace(self):
        """Block timestamps can precede order creation; 60s grace was too tight."""
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            anchor_request=self.req,
            user=self.user,
            client=client,
        )
        # Payment block time 5 minutes before the order — still within default grace.
        early_ts = int(order.created_at.timestamp()) - 300
        txid = 'ef' * 32
        client.get_transaction.return_value = BchTransaction(
            txid=txid,
            timestamp=early_ts,
            confirmations=1,
            outputs=[
                BchTxOutput(
                    address=order.address,
                    amount_sats=order.expected_amount_sats,
                ),
            ],
        )
        paid = verify_bch_payment(
            anchor_request=self.req,
            user=self.user,
            payment_txid=txid,
            client=client,
        )
        self.assertEqual(paid.status, BchDirectPayment.STATUS_PAID)
        self.assertEqual(paid.payment_txid, txid)

    def test_waiting_nowpayments_is_abandoned_when_starting_bch(self):
        CryptoPayment.objects.create(
            anchor_request=self.req,
            order_id='anchor-waiting-switch',
            payment_status='waiting',
            price_amount=1.0,
            invoice_url='https://nowpayments.io/payment/?iid=switch',
        )
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            anchor_request=self.req,
            user=self.user,
            client=client,
        )
        self.assertEqual(order.status, BchDirectPayment.STATUS_PENDING)
        abandoned = CryptoPayment.objects.get(order_id='anchor-waiting-switch')
        self.assertEqual(abandoned.payment_status, 'expired')

    def test_confirming_nowpayments_still_blocks_bch(self):
        CryptoPayment.objects.create(
            anchor_request=self.req,
            order_id='anchor-confirming-switch',
            payment_status='confirming',
            price_amount=1.0,
        )
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        with self.assertRaises(BchPaymentError) as ctx:
            create_or_reuse_bch_payment(
                anchor_request=self.req,
                user=self.user,
                client=client,
            )
        self.assertIn('confirmación', str(ctx.exception))

    @override_settings(NOWPAYMENTS_API_KEY='test-key')
    @patch('payments.services.NOWPaymentsClient.create_invoice')
    def test_pending_bch_does_not_block_nowpayments(self, mock_create_invoice):
        mock_create_invoice.return_value = {
            'id': 889,
            'invoice_url': 'https://nowpayments.io/payment/?iid=889',
        }
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        bch_order = create_or_reuse_bch_payment(
            anchor_request=self.req,
            user=self.user,
            client=client,
        )
        payment = create_anchor_request_payment(anchor_request=self.req, user=self.user)
        self.assertEqual(payment.invoice_url, 'https://nowpayments.io/payment/?iid=889')
        bch_order.refresh_from_db()
        self.assertEqual(bch_order.status, BchDirectPayment.STATUS_PENDING)

    def test_verify_logs_chain_lookup_failure(self):
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            anchor_request=self.req,
            user=self.user,
            client=client,
        )
        txid = 'aa' * 32
        client.get_transaction.side_effect = BchApiError(
            'Electrum timed out'
        )
        with self.assertLogs('payments.bch_services', level='ERROR') as logs:
            with self.assertRaises(BchPaymentError) as ctx:
                verify_bch_payment(
                    anchor_request=self.req,
                    user=self.user,
                    payment_txid=txid,
                    client=client,
                )
        self.assertIn('transacción', str(ctx.exception).lower())
        self.assertTrue(any('txid lookup failed' in line.lower() for line in logs.output))
        order.refresh_from_db()
        self.assertEqual(order.status, BchDirectPayment.STATUS_PENDING)


class BchNetworkClientTests(TestCase):
    def test_cashaddr_scripthash_roundtrip(self):
        from payments.bch_cashaddr import (
            address_to_scripthash,
            decode_cashaddr,
            encode_cashaddr,
        )
        payload = bytes.fromhex('76a04053bda0a88bda5177b86a6c6f1f9abac710')
        addr = encode_cashaddr('bitcoincash', 0, payload)
        self.assertTrue(addr.startswith('bitcoincash:'))
        prefix, version, decoded = decode_cashaddr(addr)
        self.assertEqual(prefix, 'bitcoincash')
        self.assertEqual(decoded, payload)
        scripthash = address_to_scripthash(addr)
        self.assertEqual(len(scripthash), 64)
        self.assertTrue(all(c in '0123456789abcdef' for c in scripthash))

    def test_cashaddr_official_vectors_and_production_address(self):
        """Regression: polymod must XOR 1 or every real CashAddr fails checksum."""
        from payments.bch_cashaddr import (
            CashAddrError,
            address_to_scripthash,
            decode_cashaddr,
            encode_cashaddr,
        )

        # Spec / Electron-Cash vectors (hash160 → expected CashAddr).
        vectors = [
            (
                '76a04053bda0a88bda5177b86a15c3b29f559873',
                'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
            ),
            (
                'cb481232299cd5743151ac4b2d63ae198e7bb0a9',
                'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy',
            ),
            (
                '011f28e473c95f4013d7d53ec5fbc3b42df8ed10',
                'bitcoincash:qqq3728yw0y47sqn6l2na30mcw6zm78dzqre909m2r',
            ),
        ]
        for hash_hex, expected_addr in vectors:
            payload = bytes.fromhex(hash_hex)
            encoded = encode_cashaddr('bitcoincash', 0, payload)
            self.assertEqual(encoded, expected_addr)
            prefix, version, decoded = decode_cashaddr(expected_addr)
            self.assertEqual(prefix, 'bitcoincash')
            self.assertEqual(version >> 3, 0)
            self.assertEqual(decoded, payload)

        # Live production receive address that previously raised Bad CashAddr checksum.
        prod = 'bitcoincash:qpnq74gum4tstjat4803zav9lr37v5wqaqyqrh9wjd'
        prefix, version, payload = decode_cashaddr(prod)
        self.assertEqual(prefix, 'bitcoincash')
        self.assertEqual(version >> 3, 0)
        self.assertEqual(payload.hex(), '660f551cdd5705cbaba9df117585f8e3e651c0e8')
        self.assertEqual(len(address_to_scripthash(prod)), 64)

        with self.assertRaises(CashAddrError):
            decode_cashaddr('bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6u')

    @override_settings(BCH_NETWORK='chipnet', BCH_API_BASE='ssl://chipnet.bch.ninja:50002')
    def test_build_client_chipnet_is_electrum(self):
        from payments.bch_client import BchFailoverClient, build_bch_client
        client = build_bch_client()
        self.assertIsInstance(client, BchFailoverClient)
        self.assertEqual(client.host, 'chipnet.bch.ninja')
        self.assertEqual(client.port, 50002)

    @override_settings(
        BCH_NETWORK='mainnet',
        BCH_API_BASE='https://api.blockchair.com/bitcoin-cash',
    )
    def test_build_client_mainnet_is_blockchair(self):
        from payments.bch_client import BchPublicClient, build_bch_client
        client = build_bch_client()
        self.assertIsInstance(client, BchPublicClient)

    @override_settings(
        BCH_NETWORK='mainnet',
        BCH_API_BASE='ssl://bch.imaginary.cash:50002',
        BCH_ELECTRUM_SERVERS='',
    )
    def test_build_client_mainnet_default_is_failover(self):
        from payments.bch_client import BchFailoverClient, build_bch_client
        client = build_bch_client()
        self.assertIsInstance(client, BchFailoverClient)
        self.assertEqual(client.host, 'bch.imaginary.cash')
        self.assertEqual(client.port, 50002)
        self.assertGreaterEqual(len(client.servers), 2)
        self.assertIsNotNone(client.http_fallback)

    def test_failover_fills_missing_tx_via_http(self):
        from payments.bch_client import BchFailoverClient

        primary = MagicMock()
        primary.host = 'primary.example'
        primary.port = 50002
        primary.fetch_address_history.return_value = (
            [{'tx_hash': 'aa' * 32, 'height': 100}],
            110,
        )
        primary.__enter__ = MagicMock(return_value=primary)
        primary.__exit__ = MagicMock(return_value=False)
        primary.get_transaction.side_effect = BchApiError('timed out')

        secondary = MagicMock()
        secondary.host = 'secondary.example'
        secondary.port = 50002
        secondary.get_transaction.side_effect = BchApiError('also down')

        http = MagicMock()
        expected = BchTransaction(
            txid='aa' * 32,
            timestamp=1_700_000_000,
            confirmations=11,
            outputs=[BchTxOutput(address='bitcoincash:qtest', amount_sats=123)],
        )
        http.get_transaction.return_value = expected

        client = BchFailoverClient.__new__(BchFailoverClient)
        client.servers = [primary, secondary]
        client.http_fallback = http
        client.host = primary.host
        client.port = primary.port

        txs = client.list_recent_transactions('bitcoincash:qtest', limit=5)
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0].txid, 'aa' * 32)
        http.get_transaction.assert_called_once()

    @override_settings(
        BCH_NETWORK='chipnet',
        BCH_RECEIVE_ADDRESS='',
        BCH_RECEIVE_ADDRESS_CHIPNET='bchtest:qqqqzqsrqszsvpcgpy9qkrqdpc83qygjzvupc7a6v7',
        BCH_RECEIVE_ADDRESS_MAINNET='bitcoincash:qqqqzqsrqszsvpcgpy9qkrqdpc83qygjzvcnueldtz',
    )
    def test_receive_address_prefers_chipnet_override(self):
        from payments.bch_client import get_bch_receive_address
        self.assertTrue(get_bch_receive_address().startswith('bchtest:'))


@override_settings(
    BCH_NETWORK='mainnet',
    BCH_RECEIVE_ADDRESS='bitcoincash:qqqqzqsrqszsvpcgpy9qkrqdpc83qygjzvcnueldtz',
    BCH_USD_PRICE=200,
    BCH_MIN_CONFIRMATIONS=0,
    BCH_PAYMENT_TTL_MINUTES=30,
)
class AdminBchCatalogTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = UserFactory(is_staff=True)
        self.author = UserFactory()
        self.path = KnowledgePath.objects.create(
            title='Paid Path',
            author=self.author,
            reference_price=10,
            is_visible=True,
        )
        from content.models import Topic
        self.topic = Topic.objects.create(
            title='Paid Topic',
            creator=self.author,
            reference_price=0,
            chat_enabled=True,
        )

    def test_catalog_requires_staff(self):
        self.client.force_authenticate(user=self.author)
        response = self.client.get('/api/payments/admin/bch-catalog/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_lists_paths_and_topics(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.get('/api/payments/admin/bch-catalog/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = {item['title'] for item in response.data['knowledge_paths']}
        self.assertIn('Paid Path', titles)
        topic_titles = {item['title'] for item in response.data['topics']}
        self.assertIn('Paid Topic', topic_titles)
        self.assertTrue(response.data['bch_direct_configured'])

    def test_cannot_enable_bch_on_free_path(self):
        self.path.reference_price = 0
        self.path.save(update_fields=['reference_price'])
        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(
            f'/api/payments/admin/knowledge-paths/{self.path.id}/',
            {'sales_enabled': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_enable_bch_on_paid_path(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(
            f'/api/payments/admin/knowledge-paths/{self.path.id}/',
            {'sales_enabled': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.path.refresh_from_db()
        self.assertTrue(self.path.sales_enabled)

    def test_set_path_price_and_enable_bch(self):
        self.path.reference_price = 0
        self.path.save(update_fields=['reference_price'])
        self.client.force_authenticate(user=self.staff)
        price = self.client.patch(
            f'/api/payments/admin/knowledge-paths/{self.path.id}/',
            {'reference_price': 12.5},
            format='json',
        )
        self.assertEqual(price.status_code, status.HTTP_200_OK)
        self.assertTrue(price.data['is_paid_path'])
        enabled = self.client.patch(
            f'/api/payments/admin/knowledge-paths/{self.path.id}/',
            {'sales_enabled': True},
            format='json',
        )
        self.assertEqual(enabled.status_code, status.HTTP_200_OK)
        self.path.refresh_from_db()
        self.assertEqual(self.path.reference_price, 12.5)
        self.assertTrue(self.path.sales_enabled)

    def test_zeroing_path_price_disables_sales(self):
        self.path.sales_enabled = True
        self.path.save(update_fields=['sales_enabled'])
        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(
            f'/api/payments/admin/knowledge-paths/{self.path.id}/',
            {'reference_price': 0},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.path.refresh_from_db()
        self.assertEqual(self.path.reference_price, 0)
        self.assertFalse(self.path.sales_enabled)
        self.assertFalse(response.data['is_paid_path'])
        self.assertFalse(response.data['is_for_sale'])

    def test_set_topic_price_and_enable_bch(self):
        self.client.force_authenticate(user=self.staff)
        price = self.client.patch(
            f'/api/payments/admin/topics/{self.topic.id}/',
            {'reference_price': 3.5},
            format='json',
        )
        self.assertEqual(price.status_code, status.HTTP_200_OK)
        enabled = self.client.patch(
            f'/api/payments/admin/topics/{self.topic.id}/',
            {'sales_enabled': True},
            format='json',
        )
        self.assertEqual(enabled.status_code, status.HTTP_200_OK)
        self.topic.refresh_from_db()
        self.assertEqual(self.topic.reference_price, 3.5)
        self.assertTrue(self.topic.sales_enabled)

    def test_staff_lists_and_confirms_expired_bch_order_by_txid(self):
        from datetime import timedelta
        from django.utils import timezone
        from unittest.mock import MagicMock

        buyer = UserFactory()
        self.path.sales_enabled = True
        self.path.save(update_fields=['sales_enabled'])
        purchase = KnowledgePathPurchase.objects.create(
            user=buyer,
            knowledge_path=self.path,
            price_amount=10,
            payment_status='PENDING',
        )
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            path_purchase=purchase,
            user=buyer,
            client=client,
        )
        order.status = BchDirectPayment.STATUS_EXPIRED
        order.expires_at = timezone.now() - timedelta(minutes=1)
        order.save(update_fields=['status', 'expires_at', 'updated_at'])

        self.client.force_authenticate(user=self.staff)
        listed = self.client.get('/api/payments/admin/bch-orders/')
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        ids = {item['id'] for item in listed.data['orders']}
        self.assertIn(order.id, ids)
        row = next(item for item in listed.data['orders'] if item['id'] == order.id)
        self.assertEqual(row['buyer_username'], buyer.username)
        self.assertEqual(row['product_type'], 'path')
        self.assertEqual(row['status'], 'expired')

        txid = 'ab' * 32
        confirmed = self.client.post(
            f'/api/payments/admin/bch-orders/{order.id}/confirm/',
            {'txid': txid},
            format='json',
        )
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        purchase.refresh_from_db()
        self.assertEqual(order.status, BchDirectPayment.STATUS_PAID)
        self.assertEqual(order.payment_txid, txid)
        self.assertEqual(purchase.payment_status, 'PAID')
        self.assertTrue(order.provider_payload.get('manual_confirm'))

        from notifications.models import Notification
        from utils.db_encoding import to_ascii_safe

        buyer_verb = to_ascii_safe('confirmó tu pago de')
        owner_verb = to_ascii_safe('compró tu camino de conocimiento')
        self.assertTrue(
            Notification.objects.filter(recipient=buyer).filter(
                verb__in=[buyer_verb, 'confirmó tu pago de']
            ).exists()
            or any(
                to_ascii_safe(n.verb or '') == buyer_verb
                for n in Notification.objects.filter(recipient=buyer)
            )
        )
        self.assertTrue(
            any(
                to_ascii_safe(n.verb or '') == owner_verb
                for n in Notification.objects.filter(recipient=self.author)
            )
        )

    def test_confirm_rejects_invalid_txid(self):
        from unittest.mock import MagicMock

        buyer = UserFactory()
        self.path.sales_enabled = True
        self.path.save(update_fields=['sales_enabled'])
        purchase = KnowledgePathPurchase.objects.create(
            user=buyer,
            knowledge_path=self.path,
            price_amount=10,
            payment_status='PENDING',
        )
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            path_purchase=purchase,
            user=buyer,
            client=client,
        )
        self.client.force_authenticate(user=self.staff)
        bad = self.client.post(
            f'/api/payments/admin/bch-orders/{order.id}/confirm/',
            {'txid': 'not-a-txid'},
            format='json',
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('txid', bad.data['error'].lower())

    @patch('profiles.email_service.EmailService.send_to_admins')
    def test_buyer_reports_txid_notifies_staff_and_owner(self, mock_send_to_admins):
        from unittest.mock import MagicMock
        from notifications.models import Notification
        from utils.db_encoding import to_ascii_safe

        mock_send_to_admins.return_value = {'sent': ['staff@example.com'], 'failed': []}
        buyer = UserFactory()
        self.staff.email = 'staff@example.com'
        self.staff.save(update_fields=['email'])
        self.path.sales_enabled = True
        self.path.save(update_fields=['sales_enabled'])
        purchase = KnowledgePathPurchase.objects.create(
            user=buyer,
            knowledge_path=self.path,
            price_amount=10,
            payment_status='PENDING',
        )
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            path_purchase=purchase,
            user=buyer,
            client=client,
        )
        txid = 'cd' * 32

        self.client.force_authenticate(user=buyer)
        reported = self.client.post(
            f'/api/payments/bch-orders/{order.id}/report-txid/',
            {'txid': txid, 'note': 'Desde Electron Cash'},
            format='json',
        )
        self.assertEqual(reported.status_code, status.HTTP_200_OK)
        self.assertTrue(reported.data['notified'])
        self.assertEqual(reported.data['reported_txid'], txid)

        order.refresh_from_db()
        self.assertEqual(order.provider_payload.get('reported_txid'), txid)
        self.assertEqual(order.provider_payload.get('reported_note'), 'Desde Electron Cash')
        self.assertEqual(order.status, BchDirectPayment.STATUS_PENDING)
        self.assertFalse(order.payment_txid)

        staff_verb = to_ascii_safe('reportó un pago BCH')
        staff_notes = Notification.objects.filter(recipient=self.staff, actor_object_id=buyer.id)
        self.assertTrue(
            any(to_ascii_safe(n.verb or '') == staff_verb for n in staff_notes),
            f'staff verbs={[n.verb for n in staff_notes]}',
        )
        owner_verb = to_ascii_safe('reportó un pago BCH de')
        owner_notes = Notification.objects.filter(recipient=self.author, actor_object_id=buyer.id)
        self.assertTrue(
            any(to_ascii_safe(n.verb or '') == owner_verb for n in owner_notes),
            f'owner verbs={[n.verb for n in owner_notes]}',
        )
        self.assertTrue(mock_send_to_admins.called)
        call_kwargs = mock_send_to_admins.call_args[1]
        self.assertEqual(call_kwargs['template_name'], 'bch_txid_reported')
        self.assertIn(str(order.id), call_kwargs['subject'])

        self.client.force_authenticate(user=self.staff)
        listed = self.client.get('/api/payments/admin/bch-orders/')
        row = next(item for item in listed.data['orders'] if item['id'] == order.id)
        self.assertEqual(row['reported_txid'], txid)

        # Same TXID again → no duplicate notify flag
        self.client.force_authenticate(user=buyer)
        again = self.client.post(
            f'/api/payments/bch-orders/{order.id}/report-txid/',
            {'txid': txid},
            format='json',
        )
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertFalse(again.data['notified'])

    def test_report_txid_rejects_non_buyer(self):
        from unittest.mock import MagicMock

        buyer = UserFactory()
        other = UserFactory()
        self.path.sales_enabled = True
        self.path.save(update_fields=['sales_enabled'])
        purchase = KnowledgePathPurchase.objects.create(
            user=buyer,
            knowledge_path=self.path,
            price_amount=10,
            payment_status='PENDING',
        )
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            path_purchase=purchase,
            user=buyer,
            client=client,
        )
        self.client.force_authenticate(user=other)
        response = self.client.post(
            f'/api/payments/bch-orders/{order.id}/report-txid/',
            {'txid': 'ab' * 32},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


@override_settings(
    BCH_NETWORK='mainnet',
    BCH_RECEIVE_ADDRESS='bitcoincash:qqqqzqsrqszsvpcgpy9qkrqdpc83qygjzvcnueldtz',
    BCH_USD_PRICE=200,
    BCH_MIN_CONFIRMATIONS=0,
    BCH_PAYMENT_TTL_MINUTES=30,
)
class PathAndTopicBchPaymentTests(TestCase):
    def setUp(self):
        self.author = UserFactory()
        self.buyer = UserFactory()
        self.path = KnowledgePath.objects.create(
            title='BCH Path',
            author=self.author,
            reference_price=2,
            sales_enabled=True,
            is_visible=True,
        )
        self.purchase = KnowledgePathPurchase.objects.create(
            user=self.buyer,
            knowledge_path=self.path,
            payment_status='PENDING',
            price_amount=2,
        )
        from content.models import Topic, TopicPurchase
        self.topic = Topic.objects.create(
            title='BCH Topic',
            creator=self.author,
            reference_price=4,
            sales_enabled=True,
            chat_enabled=True,
        )
        self.topic_purchase = TopicPurchase.objects.create(
            user=self.buyer,
            topic=self.topic,
            payment_status='PENDING',
            price_amount=4,
        )

    def _paid_tx(self, order, txid='ef' * 32):
        return BchTransaction(
            txid=txid,
            timestamp=int(order.created_at.timestamp()) + 10,
            confirmations=1,
            outputs=[
                BchTxOutput(address=order.address, amount_sats=order.expected_amount_sats),
            ],
        )

    def test_path_bch_requires_flag(self):
        self.path.sales_enabled = False
        self.path.save(update_fields=['sales_enabled'])
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        with self.assertRaises(BchPaymentError):
            create_or_reuse_bch_payment(
                path_purchase=self.purchase,
                user=self.buyer,
                client=client,
            )

    def test_path_bch_verify_unlocks(self):
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            path_purchase=self.purchase,
            user=self.buyer,
            client=client,
        )
        txid = 'ef' * 32
        client.get_transaction.return_value = self._paid_tx(order, txid=txid)
        paid = verify_bch_payment(
            path_purchase=self.purchase,
            user=self.buyer,
            payment_txid=txid,
            client=client,
        )
        self.assertEqual(paid.status, BchDirectPayment.STATUS_PAID)
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.payment_status, 'PAID')

        from notifications.models import Notification
        from utils.db_encoding import to_ascii_safe

        buyer_verb = to_ascii_safe('confirmó tu pago de')
        owner_verb = to_ascii_safe('compró tu camino de conocimiento')
        buyer_notes = Notification.objects.filter(recipient=self.buyer)
        owner_notes = Notification.objects.filter(recipient=self.author)
        self.assertTrue(
            any(to_ascii_safe(n.verb or '') == buyer_verb for n in buyer_notes),
            f'buyer verbs={[n.verb for n in buyer_notes]}',
        )
        self.assertTrue(
            any(to_ascii_safe(n.verb or '') == owner_verb for n in owner_notes),
            f'owner verbs={[n.verb for n in owner_notes]}',
        )

    def test_topic_bch_verify_unlocks(self):
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            topic_purchase=self.topic_purchase,
            user=self.buyer,
            client=client,
        )
        txid = 'ef' * 32
        client.get_transaction.return_value = self._paid_tx(order, txid=txid)
        paid = verify_bch_payment(
            topic_purchase=self.topic_purchase,
            user=self.buyer,
            payment_txid=txid,
            client=client,
        )
        self.assertEqual(paid.status, BchDirectPayment.STATUS_PAID)
        self.topic_purchase.refresh_from_db()
        self.assertEqual(self.topic_purchase.payment_status, 'PAID')

        from notifications.models import Notification
        from utils.db_encoding import to_ascii_safe

        buyer_verb = to_ascii_safe('confirmó tu pago de')
        owner_verb = to_ascii_safe('compró acceso a las consultas de')
        buyer_notes = Notification.objects.filter(recipient=self.buyer)
        owner_notes = Notification.objects.filter(recipient=self.author)
        self.assertTrue(
            any(to_ascii_safe(n.verb or '') == buyer_verb for n in buyer_notes),
            f'buyer verbs={[n.verb for n in buyer_notes]}',
        )
        self.assertTrue(
            any(to_ascii_safe(n.verb or '') == owner_verb for n in owner_notes),
            f'owner verbs={[n.verb for n in owner_notes]}',
        )

    def test_waiting_nowpayments_is_abandoned_when_starting_path_bch(self):
        CryptoPayment.objects.create(
            path_purchase=self.purchase,
            order_id='kp-waiting-switch',
            payment_status='waiting',
            price_amount=2,
            invoice_url='https://nowpayments.io/payment/?iid=path',
        )
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            path_purchase=self.purchase,
            user=self.buyer,
            client=client,
        )
        self.assertEqual(order.status, BchDirectPayment.STATUS_PENDING)
        abandoned = CryptoPayment.objects.get(order_id='kp-waiting-switch')
        self.assertEqual(abandoned.payment_status, 'expired')

    def test_confirming_nowpayments_still_blocks_path_bch(self):
        CryptoPayment.objects.create(
            path_purchase=self.purchase,
            order_id='kp-confirming-switch',
            payment_status='confirming',
            price_amount=2,
        )
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        with self.assertRaises(BchPaymentError) as ctx:
            create_or_reuse_bch_payment(
                path_purchase=self.purchase,
                user=self.buyer,
                client=client,
            )
        self.assertIn('confirmación', str(ctx.exception))

    @override_settings(
        BCH_NETWORK='mainnet',
        BCH_RECEIVE_ADDRESS='bitcoincash:qqqqzqsrqszsvpcgpy9qkrqdpc83qygjzvcnueldtz',
        BCH_USD_PRICE=200,
    )
    @patch('payments.views.verify_bch_payment')
    def test_path_bch_verify_view_logs_payment_errors(self, mock_verify):
        mock_verify.side_effect = BchPaymentError(
            'No se pudo consultar la blockchain de BCH. Inténtalo más tarde '
            'o avísanos por mensaje con el monto y la dirección de la orden.'
        )
        api = APIClient()
        api.force_authenticate(user=self.buyer)
        with self.assertLogs('payments.views', level='WARNING') as logs:
            response = api.post(
                f'/api/payments/path-purchase/{self.purchase.id}/bch/verify/',
                {'txid': 'ab' * 32},
                format='json',
            )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(
            any('verify_path_bch failed' in line for line in logs.output),
            logs.output,
        )
        self.assertIn('blockchain', response.data['error'].lower())
        self.assertIn('inténtalo', response.data['error'].lower())
        self.assertIn('avísanos', response.data['error'].lower())


@override_settings(
    BCH_NETWORK='mainnet',
    BCH_RECEIVE_ADDRESS='bitcoincash:qqqqzqsrqszsvpcgpy9qkrqdpc83qygjzvcnueldtz',
    BCH_USD_PRICE=200,
    BCH_MIN_CONFIRMATIONS=0,
    BCH_PAYMENT_TTL_MINUTES=30,
)
class TokenPackagePurchaseTests(TestCase):
    def setUp(self):
        self.buyer = UserFactory()
        self.other = UserFactory()
        self.staff = UserFactory(is_staff=True)
        self.package = TokenPackage.objects.create(
            name='Test 50 tokens',
            token_amount=50,
            usd_price=Decimal('4.00'),
            is_active=True,
            sort_order=99,
        )
        self.api = APIClient()

    def test_list_active_packages(self):
        TokenPackage.objects.create(
            name='Hidden pack',
            token_amount=10,
            usd_price=Decimal('1.00'),
            is_active=False,
        )
        self.api.force_authenticate(user=self.buyer)
        response = self.api.get('/api/payments/token-packages/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [row['name'] for row in response.data]
        self.assertIn('Test 50 tokens', names)
        self.assertNotIn('Hidden pack', names)

    def test_create_purchase_and_forbid_other_user_payment(self):
        self.api.force_authenticate(user=self.buyer)
        created = self.api.post(
            '/api/payments/token-purchases/',
            {'package_id': self.package.id},
            format='json',
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        purchase_id = created.data['id']
        self.assertEqual(created.data['payment_status'], 'PENDING')
        self.assertEqual(created.data['token_amount'], 50)

        self.api.force_authenticate(user=self.other)
        denied = self.api.post(f'/api/payments/token-purchase/{purchase_id}/')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(NOWPAYMENTS_API_KEY='test-key')
    @patch('payments.services.NOWPaymentsClient.create_invoice')
    def test_nowpayments_fulfill_credits_once(self, mock_create_invoice):
        mock_create_invoice.return_value = {
            'id': 4242,
            'invoice_url': 'https://nowpayments.io/payment/?iid=4242',
        }
        purchase = create_token_purchase(package=self.package, user=self.buyer)
        payment = create_token_purchase_payment(token_purchase=purchase, user=self.buyer)
        self.assertEqual(payment.token_purchase_id, purchase.id)
        self.assertTrue(payment.order_id.startswith('tok-purchase-'))
        self.assertIsNone(payment.path_purchase_id)
        self.assertIsNone(payment.event_registration_id)

        payload = {
            'payment_status': 'finished',
            'actually_paid': '0.02',
            'pay_amount': '0.02',
        }
        sync_payment_from_provider(payment, payload)
        sync_payment_from_provider(payment, payload)

        purchase.refresh_from_db()
        self.buyer.profile.refresh_from_db()
        self.assertEqual(purchase.payment_status, 'PAID')
        self.assertEqual(self.buyer.profile.token_balance, 50)
        self.assertEqual(
            TokenLedgerEntry.objects.filter(
                token_purchase=purchase,
                reason=TokenLedgerEntry.REASON_PURCHASE,
            ).count(),
            1,
        )

    def test_bch_verify_credits_tokens(self):
        purchase = create_token_purchase(package=self.package, user=self.buyer)
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            token_purchase=purchase,
            user=self.buyer,
            client=client,
        )
        self.assertEqual(order.token_purchase_id, purchase.id)
        self.assertIsNone(order.path_purchase_id)
        txid = 'ab' * 32
        client.get_transaction.return_value = BchTransaction(
            txid=txid,
            timestamp=int(order.created_at.timestamp()) + 10,
            confirmations=1,
            outputs=[
                BchTxOutput(address=order.address, amount_sats=order.expected_amount_sats),
            ],
        )
        paid = verify_bch_payment(
            token_purchase=purchase,
            user=self.buyer,
            payment_txid=txid,
            client=client,
        )
        self.assertEqual(paid.status, BchDirectPayment.STATUS_PAID)
        purchase.refresh_from_db()
        self.buyer.profile.refresh_from_db()
        self.assertEqual(purchase.payment_status, 'PAID')
        self.assertEqual(self.buyer.profile.token_balance, 50)

    def test_staff_confirm_credits_tokens(self):
        from payments.bch_services import manual_confirm_bch_payment

        purchase = create_token_purchase(package=self.package, user=self.buyer)
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            token_purchase=purchase,
            user=self.buyer,
            client=client,
        )
        confirmed = manual_confirm_bch_payment(
            payment_id=order.pk,
            txid='cd' * 32,
            staff_user=self.staff,
        )
        self.assertEqual(confirmed.status, BchDirectPayment.STATUS_PAID)
        self.assertEqual(
            get_bch_payment_product_meta(confirmed)['product_type'],
            'token_package',
        )
        purchase.refresh_from_db()
        self.buyer.profile.refresh_from_db()
        self.assertEqual(purchase.payment_status, 'PAID')
        self.assertEqual(self.buyer.profile.token_balance, 50)

        confirmed_again = manual_confirm_bch_payment(
            payment_id=order.pk,
            txid='cd' * 32,
            staff_user=self.staff,
        )
        self.assertEqual(confirmed_again.pk, confirmed.pk)
        self.buyer.profile.refresh_from_db()
        self.assertEqual(self.buyer.profile.token_balance, 50)

    def test_xor_constraint_rejects_two_targets(self):
        from django.db import IntegrityError

        purchase = create_token_purchase(package=self.package, user=self.buyer)
        path = KnowledgePath.objects.create(
            title='XOR Path',
            author=self.other,
            reference_price=5,
            is_visible=True,
        )
        path_purchase = KnowledgePathPurchase.objects.create(
            user=self.buyer,
            knowledge_path=path,
            payment_status='PENDING',
            price_amount=5,
        )
        with self.assertRaises(IntegrityError):
            CryptoPayment.objects.create(
                path_purchase=path_purchase,
                token_purchase=purchase,
                order_id='tok-xor-invalid',
                price_amount=5,
                payment_status='waiting',
            )

    def test_profile_token_balance_only_for_owner(self):
        self.buyer.profile.token_balance = 12
        self.buyer.profile.save(update_fields=['token_balance'])
        self.api.force_authenticate(user=self.buyer)
        own = self.api.get('/api/profiles/user_profile/')
        self.assertEqual(own.status_code, status.HTTP_200_OK)
        self.assertEqual(own.data['token_balance'], 12)

        self.api.force_authenticate(user=self.other)
        other = self.api.get(f'/api/profiles/{self.buyer.id}/')
        self.assertEqual(other.status_code, status.HTTP_200_OK)
        self.assertIsNone(other.data.get('token_balance'))