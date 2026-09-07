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
    verify_bch_payment,
)
from payments.models import BchDirectPayment, CryptoPayment
from payments.nowpayments_client import NOWPaymentsClient, NOWPaymentsError
from payments.services import (
    create_anchor_request_payment,
    create_path_purchase_payment,
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
    BCH_RECEIVE_ADDRESS='bitcoincash:qpetestplaceholder0000000000000000000000',
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
        client.list_recent_transactions.return_value = [
            BchTransaction(
                txid='ab' * 32,
                timestamp=int(order.created_at.timestamp()) + 10,
                confirmations=1,
                outputs=[
                    BchTxOutput(
                        address=order.address,
                        amount_sats=order.expected_amount_sats,
                    ),
                ],
            ),
        ]
        paid = verify_bch_payment(
            anchor_request=self.req,
            user=self.user,
            client=client,
        )
        self.assertEqual(paid.status, BchDirectPayment.STATUS_PAID)
        self.assertEqual(paid.payment_txid, 'ab' * 32)
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, TranscriptAnchorRequest.STATUS_PAID_PENDING_REVIEW)

    def test_verify_wrong_amount_fails(self):
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            anchor_request=self.req,
            user=self.user,
            client=client,
        )
        client.list_recent_transactions.return_value = [
            BchTransaction(
                txid='cd' * 32,
                timestamp=int(order.created_at.timestamp()) + 10,
                confirmations=1,
                outputs=[
                    BchTxOutput(address=order.address, amount_sats=order.expected_amount_sats + 1),
                ],
            ),
        ]
        with self.assertRaises(BchPaymentError):
            verify_bch_payment(anchor_request=self.req, user=self.user, client=client)
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, TranscriptAnchorRequest.STATUS_PENDING_PAYMENT)

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
        client.list_recent_transactions.side_effect = BchApiError(
            'Blockchair error 430: blacklisted'
        )
        with self.assertLogs('payments.bch_services', level='ERROR') as logs:
            with self.assertRaises(BchPaymentError) as ctx:
                verify_bch_payment(anchor_request=self.req, user=self.user, client=client)
        self.assertIn('blockchain', str(ctx.exception).lower())
        self.assertTrue(any('chain lookup failed' in line.lower() for line in logs.output))
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

    @override_settings(BCH_NETWORK='chipnet', BCH_API_BASE='ssl://chipnet.bch.ninja:50002')
    def test_build_client_chipnet_is_electrum(self):
        from payments.bch_client import BchElectrumClient, build_bch_client
        client = build_bch_client()
        self.assertIsInstance(client, BchElectrumClient)
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
    )
    def test_build_client_mainnet_default_is_electrum(self):
        from payments.bch_client import BchElectrumClient, build_bch_client
        client = build_bch_client()
        self.assertIsInstance(client, BchElectrumClient)
        self.assertEqual(client.host, 'bch.imaginary.cash')
        self.assertEqual(client.port, 50002)

    @override_settings(
        BCH_NETWORK='chipnet',
        BCH_RECEIVE_ADDRESS='',
        BCH_RECEIVE_ADDRESS_CHIPNET='bchtest:qpechipnetplaceholder00000000000000000',
        BCH_RECEIVE_ADDRESS_MAINNET='bitcoincash:qpemainnetplaceholder000000000000000',
    )
    def test_receive_address_prefers_chipnet_override(self):
        from payments.bch_client import get_bch_receive_address
        self.assertTrue(get_bch_receive_address().startswith('bchtest:'))


@override_settings(
    BCH_NETWORK='mainnet',
    BCH_RECEIVE_ADDRESS='bitcoincash:qpetestplaceholder0000000000000000000000',
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
            {'bch_direct_enabled': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_enable_bch_on_paid_path(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(
            f'/api/payments/admin/knowledge-paths/{self.path.id}/',
            {'bch_direct_enabled': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.path.refresh_from_db()
        self.assertTrue(self.path.bch_direct_enabled)

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
            {'bch_direct_enabled': True},
            format='json',
        )
        self.assertEqual(enabled.status_code, status.HTTP_200_OK)
        self.topic.refresh_from_db()
        self.assertEqual(self.topic.reference_price, 3.5)
        self.assertTrue(self.topic.bch_direct_enabled)


@override_settings(
    BCH_NETWORK='mainnet',
    BCH_RECEIVE_ADDRESS='bitcoincash:qpetestplaceholder0000000000000000000000',
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
            bch_direct_enabled=True,
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
            bch_direct_enabled=True,
            chat_enabled=True,
        )
        self.topic_purchase = TopicPurchase.objects.create(
            user=self.buyer,
            topic=self.topic,
            payment_status='PENDING',
            price_amount=4,
        )

    def _paid_tx(self, order):
        return [
            BchTransaction(
                txid='ef' * 32,
                timestamp=int(order.created_at.timestamp()) + 10,
                confirmations=1,
                outputs=[
                    BchTxOutput(address=order.address, amount_sats=order.expected_amount_sats),
                ],
            ),
        ]

    def test_path_bch_requires_flag(self):
        self.path.bch_direct_enabled = False
        self.path.save(update_fields=['bch_direct_enabled'])
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
        client.list_recent_transactions.return_value = self._paid_tx(order)
        paid = verify_bch_payment(
            path_purchase=self.purchase,
            user=self.buyer,
            client=client,
        )
        self.assertEqual(paid.status, BchDirectPayment.STATUS_PAID)
        self.purchase.refresh_from_db()
        self.assertEqual(self.purchase.payment_status, 'PAID')

    def test_topic_bch_verify_unlocks(self):
        client = MagicMock()
        client.get_bch_usd_rate.return_value = Decimal('200')
        order = create_or_reuse_bch_payment(
            topic_purchase=self.topic_purchase,
            user=self.buyer,
            client=client,
        )
        client.list_recent_transactions.return_value = self._paid_tx(order)
        paid = verify_bch_payment(
            topic_purchase=self.topic_purchase,
            user=self.buyer,
            client=client,
        )
        self.assertEqual(paid.status, BchDirectPayment.STATUS_PAID)
        self.topic_purchase.refresh_from_db()
        self.assertEqual(self.topic_purchase.payment_status, 'PAID')

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
        BCH_RECEIVE_ADDRESS='bitcoincash:qpetestplaceholder0000000000000000000000',
        BCH_USD_PRICE=200,
    )
    @patch('payments.views.verify_bch_payment')
    def test_path_bch_verify_view_logs_payment_errors(self, mock_verify):
        mock_verify.side_effect = BchPaymentError(
            'No se pudo consultar la blockchain de BCH. Inténtelo más tarde.'
        )
        api = APIClient()
        api.force_authenticate(user=self.buyer)
        with self.assertLogs('payments.views', level='WARNING') as logs:
            response = api.post(f'/api/payments/path-purchase/{self.purchase.id}/bch/verify/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(
            any('verify_path_bch failed' in line for line in logs.output),
            logs.output,
        )
        self.assertIn('blockchain', response.data['error'].lower())
