from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from content.bitcoin.service import (
    AnchorBroadcastError,
    broadcast_anchor,
    ensure_pending_anchor,
    refresh_anchor_confirmations,
)
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

            dry = broadcast_anchor(anchor, dry_run=True, client=client)
            self.assertEqual(dry.status, TranscriptAnchor.STATUS_PENDING)
            self.assertFalse(dry.btc_txid)
            client.broadcast.assert_not_called()

            live = broadcast_anchor(anchor, dry_run=False, client=client)
            self.assertEqual(live.status, TranscriptAnchor.STATUS_BTC_BROADCAST)
            self.assertEqual(live.btc_txid, 'abcd' * 16)
            client.broadcast.assert_called_once()
            self.assertEqual(live.metadata.get('from_address'), address)

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
