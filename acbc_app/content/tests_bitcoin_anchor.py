from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from content.bitcoin.fees import FEE_TOO_HIGH_MESSAGE, FeeBudgetError, assert_fee_within_usd_budget
from content.bitcoin.service import (
    AnchorBroadcastError,
    broadcast_anchor,
    ensure_pending_anchor,
    refresh_anchor_confirmations,
    set_anchor_network,
)
from content.bitcoin.esplora import BitcoinApiError, api_base_for_network
from content.bitcoin.tx_builder import (
    build_and_sign_op_return_tx,
    build_op_return_script,
    p2wpkh_address,
    private_key_from_wif,
    select_utxos,
)
from content.models import Content, ContentTranscript, TranscriptAnchor
from embit import ec
from embit.networks import NETWORKS
import os


def _signet_wif():
    return ec.PrivateKey(os.urandom(32)).wif(network=NETWORKS['signet'])


class TxBuilderTests(TestCase):
    def test_op_return_script_length(self):
        payload = b'ACBC1' + b'\xab' * 32
        script = build_op_return_script(payload)
        raw = bytes(script.data) if hasattr(script, 'data') else script.serialize()
        # Script.data may include compact size; check payload embedded
        self.assertIn(b'ACBC1', raw if isinstance(raw, (bytes, bytearray)) else script.serialize())

    def test_select_utxos_greedy(self):
        utxos = [
            {'txid': 'aa' * 32, 'vout': 0, 'value': 1000},
            {'txid': 'bb' * 32, 'vout': 1, 'value': 50_000},
        ]
        selected = select_utxos(utxos, 10_000)
        self.assertEqual(len(selected), 1)
        self.assertEqual(selected[0]['value'], 50_000)

    def test_build_and_sign_creates_op_return(self):
        wif = _signet_wif()
        key = private_key_from_wif(wif, 'signet')
        address = p2wpkh_address(key, 'signet')
        payload = b'ACBC1' + bytes.fromhex('11' * 32)
        utxos = [{'txid': '22' * 32, 'vout': 0, 'value': 100_000, 'status': {'confirmed': True}}]
        built = build_and_sign_op_return_tx(
            wif=wif,
            network_name='signet',
            op_return_payload=payload,
            utxos=utxos,
            fee_sat_vb=2,
        )
        self.assertEqual(built.from_address, address)
        self.assertTrue(built.raw_tx_hex)
        self.assertIn('6a25', built.raw_tx_hex)  # OP_RETURN push 37 bytes
        self.assertGreater(built.fee_sats, 0)


@override_settings(
    BTC_NETWORK='signet',
    BTC_API_BASE='https://mempool.space/signet/api',
    BTC_MIN_CONFIRMATIONS=1,
    BTC_MAX_FEE_USD=1,
    BTC_USD_PRICE=60000,
)
class AnchorBroadcastServiceTests(TestCase):
    def setUp(self):
        self.wif = _signet_wif()
        self.user = User.objects.create_user('btcuser', 'btc@example.com', 'pass')
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='VIDEO',
            original_title='BTC anchor video',
        )
        self.transcript = ContentTranscript.objects.create(
            content=self.content,
            processed_plain='Texto para anclar en signet.',
            language='es',
        )

    @override_settings(BTC_PRIVATE_KEY_WIF='')
    def test_broadcast_requires_wif(self):
        anchor = ensure_pending_anchor(self.content, network='signet')
        with self.assertRaises(AnchorBroadcastError):
            broadcast_anchor(anchor)

    def test_ensure_pending_anchor_idempotent(self):
        a1 = ensure_pending_anchor(self.content, network='signet', anchored_by=self.user)
        a2 = ensure_pending_anchor(self.content, network='signet')
        self.assertEqual(a1.pk, a2.pk)
        self.assertEqual(a1.text_hash, self.transcript.text_hash)
        self.assertTrue(a1.certified_plain_text)
        self.assertEqual(
            a1.certified_plain_text,
            self.transcript.processed_plain.strip(),
        )
        self.assertTrue(a1.btc_op_return_hex.startswith(b'ACBC1'.hex()))

    @override_settings()
    def test_broadcast_dry_run_and_live(self):
        from django.test.utils import override_settings as _os
        with _os(BTC_PRIVATE_KEY_WIF=self.wif):
            from content.bitcoin.tx_builder import p2wpkh_address, private_key_from_wif
            address = p2wpkh_address(private_key_from_wif(self.wif, 'signet'), 'signet')
            anchor = ensure_pending_anchor(self.content, network='signet')
            client = MagicMock()
            client.get_address_utxos.return_value = [
                {'txid': '33' * 32, 'vout': 0, 'value': 200_000, 'status': {'confirmed': True}},
            ]
            client.get_recommended_fee_sat_vb.return_value = 2
            client.broadcast.return_value = 'abcd' * 16
            client.get_tx_or_none.return_value = None

            dry = broadcast_anchor(anchor, dry_run=True, client=client)
            self.assertEqual(dry.status, TranscriptAnchor.STATUS_PENDING)
            self.assertFalse(dry.btc_txid)
            client.broadcast.assert_not_called()

            live = broadcast_anchor(anchor, dry_run=False, client=client)
            self.assertEqual(live.status, TranscriptAnchor.STATUS_BTC_BROADCAST)
            self.assertEqual(live.btc_txid, 'abcd' * 16)
            client.broadcast.assert_called_once()
            self.assertEqual(live.metadata.get('from_address'), address)
            self.assertNotIn('signed_raw_tx_hex', live.metadata or {})

    @override_settings(BTC_PRIVATE_KEY_WIF='ignored')
    def test_refresh_marks_anchored(self):
        anchor = ensure_pending_anchor(self.content, network='signet')
        anchor.status = TranscriptAnchor.STATUS_BTC_BROADCAST
        anchor.btc_txid = 'ff' * 32
        anchor.save()
        client = MagicMock()
        client.get_tx_status.return_value = {
            'status': {
                'confirmed': True,
                'block_height': 100,
                'block_hash': 'aa' * 32,
            }
        }
        client.get_tip_height.return_value = 100
        refreshed = refresh_anchor_confirmations(anchor, client=client)
        self.assertEqual(refreshed.status, TranscriptAnchor.STATUS_ANCHORED)
        self.assertEqual(refreshed.btc_confirmations, 1)
        self.assertIsNotNone(refreshed.btc_confirmed_at)

    @override_settings(BTC_PRIVATE_KEY_WIF='ignored', BTC_MAX_FEE_USD=1, BTC_USD_PRICE=60000)
    def test_broadcast_rejects_fee_over_one_dollar(self):
        with override_settings(BTC_PRIVATE_KEY_WIF=self.wif):
            anchor = ensure_pending_anchor(self.content, network='signet')
            client = MagicMock()
            client.get_address_utxos.return_value = [
                {'txid': '33' * 32, 'vout': 0, 'value': 200_000, 'status': {'confirmed': True}},
            ]
            # 25 sat/vB * ~160 vB ≈ 4000 sats → ~$2.40 at $60k BTC
            client.get_recommended_fee_sat_vb.return_value = 25
            client.get_tx_or_none.return_value = None

            with self.assertRaises(AnchorBroadcastError) as ctx:
                broadcast_anchor(anchor, client=client)
            self.assertEqual(str(ctx.exception), FEE_TOO_HIGH_MESSAGE)
            self.assertIsInstance(ctx.exception.__cause__, FeeBudgetError)
            client.broadcast.assert_not_called()
            anchor.refresh_from_db()
            self.assertEqual(anchor.status, TranscriptAnchor.STATUS_PENDING)
            self.assertFalse(anchor.btc_txid)

    @override_settings(BTC_MAX_FEE_USD=1, BTC_USD_PRICE=60000)
    def test_assert_fee_within_budget_passes_under_one_dollar(self):
        # 1600 sats at $60k ≈ $0.96
        usd = assert_fee_within_usd_budget(1600, btc_usd=60000)
        self.assertLessEqual(usd, 1.0)

    @override_settings(BTC_PRIVATE_KEY_WIF='ignored')
    def test_wallet_error_persists_failed_status(self):
        with override_settings(BTC_PRIVATE_KEY_WIF=self.wif):
            anchor = ensure_pending_anchor(self.content, network='signet')
            client = MagicMock()
            client.get_address_utxos.side_effect = BitcoinApiError('UTXO fetch failed')

            with self.assertRaises(AnchorBroadcastError):
                broadcast_anchor(anchor, client=client)
            anchor.refresh_from_db()
            self.assertEqual(anchor.status, TranscriptAnchor.STATUS_FAILED)
            self.assertIn('UTXO fetch failed', anchor.error_message)

    @override_settings()
    def test_retry_reuses_prepared_txid_without_second_broadcast(self):
        with override_settings(BTC_PRIVATE_KEY_WIF=self.wif):
            anchor = ensure_pending_anchor(self.content, network='signet')
            predicted = 'ab' * 32
            anchor.metadata = {
                'signed_raw_tx_hex': '01' * 40,
                'predicted_txid': predicted,
                'from_address': 'tb1qtest',
            }
            anchor.save(update_fields=['metadata', 'updated_at'])

            client = MagicMock()
            client.get_tx_or_none.return_value = {
                'txid': predicted,
                'status': {'confirmed': False},
            }

            result = broadcast_anchor(anchor, client=client)
            self.assertEqual(result.status, TranscriptAnchor.STATUS_BTC_BROADCAST)
            self.assertEqual(result.btc_txid, predicted)
            client.broadcast.assert_not_called()
            client.get_address_utxos.assert_not_called()

    def test_network_immutable_after_prepared_broadcast(self):
        anchor = ensure_pending_anchor(self.content, network='signet')
        anchor.metadata = {
            'signed_raw_tx_hex': '01' * 40,
            'predicted_txid': 'cd' * 32,
        }
        anchor.save(update_fields=['metadata', 'updated_at'])
        with self.assertRaises(AnchorBroadcastError):
            set_anchor_network(anchor, 'mainnet')
        anchor.refresh_from_db()
        self.assertEqual(anchor.btc_network, 'signet')

    def test_api_base_for_network_ignores_global_override_for_other_networks(self):
        with override_settings(BTC_NETWORK='signet', BTC_API_BASE='https://custom.example/api'):
            with patch.dict('os.environ', {'BTC_API_BASE': 'https://custom.example/api'}):
                self.assertEqual(
                    api_base_for_network('signet'),
                    'https://custom.example/api',
                )
                self.assertEqual(
                    api_base_for_network('mainnet'),
                    'https://mempool.space/api',
                )

    @override_settings(BTC_PRIVATE_KEY_WIF='ignored', BTC_MIN_CONFIRMATIONS=2)
    def test_refresh_demotes_anchored_after_reorg(self):
        anchor = ensure_pending_anchor(self.content, network='signet')
        anchor.status = TranscriptAnchor.STATUS_ANCHORED
        anchor.btc_txid = 'ff' * 32
        anchor.btc_confirmations = 3
        anchor.save()
        client = MagicMock()
        client.get_tx_status.return_value = {
            'status': {
                'confirmed': True,
                'block_height': 100,
                'block_hash': 'aa' * 32,
            }
        }
        # tip - height + 1 = 1 confirmation → below min_conf=2
        client.get_tip_height.return_value = 100
        refreshed = refresh_anchor_confirmations(anchor, client=client)
        self.assertEqual(refreshed.status, TranscriptAnchor.STATUS_BTC_BROADCAST)
        self.assertEqual(refreshed.btc_confirmations, 1)
        self.assertIn('reorg_demoted_at', refreshed.metadata)


class CertifiedTextDownloadAPITests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient

        self.client = APIClient()
        self.user = User.objects.create_user('dluser', 'dl@example.com', 'pass')
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='VIDEO',
            original_title='Downloadable anchor',
        )
        self.transcript = ContentTranscript.objects.create(
            content=self.content,
            processed_plain='Texto certificado exacto.',
            language='es',
        )
        self.anchor = ensure_pending_anchor(self.content, network='signet')

    def test_download_certified_text_matches_hash_header(self):
        url = (
            f'/api/content/content_details/{self.content.id}/'
            f'transcript/anchors/{self.anchor.id}/certified-text/'
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/plain; charset=utf-8')
        self.assertEqual(response['X-Expected-Text-Hash'], self.anchor.text_hash)
        self.assertEqual(response['X-Text-Hash'], self.anchor.text_hash)
        self.assertEqual(response['X-Hash-Match'], 'true')
        self.assertEqual(
            response.content.decode('utf-8'),
            self.anchor.certified_plain_text,
        )

    def test_download_missing_certified_text_returns_404(self):
        self.anchor.certified_plain_text = ''
        self.anchor.save(update_fields=['certified_plain_text', 'updated_at'])
        url = (
            f'/api/content/content_details/{self.content.id}/'
            f'transcript/anchors/{self.anchor.id}/certified-text/'
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['code'], 'certified_text_missing')
