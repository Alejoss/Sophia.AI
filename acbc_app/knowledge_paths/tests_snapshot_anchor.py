"""Tests for knowledge-path snapshot Bitcoin OP_RETURN anchors."""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from content.models import Content, ContentProfile, ContentTranscript
from knowledge_paths.models import (
    KnowledgePath,
    KnowledgePathSnapshotAnchor,
    Node,
)
from knowledge_paths.services.snapshot_anchor import (
    blockchain_payload_for_snapshot,
    ensure_pending_snapshot_anchor,
    serialize_snapshot_anchor,
)
from knowledge_paths.services.snapshot_publish import publish_knowledge_path_snapshot


@override_settings(
    BTC_NETWORK='signet',
    BTC_API_BASE='https://mempool.space/signet/api',
    BTC_MIN_CONFIRMATIONS=1,
    BTC_MAX_FEE_USD=10,
    BTC_USD_PRICE=60000,
    BTC_PRIVATE_KEY_WIF='cVtestplaceholder',
)
class SnapshotAnchorServiceTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            'kp-admin', 'kp@example.com', 'pass', is_staff=True,
        )
        self.path = KnowledgePath.objects.create(
            title='KP Bitcoin',
            description='desc',
            author=self.admin,
        )
        content = Content.objects.create(
            uploaded_by=self.admin,
            media_type='VIDEO',
            original_title='Lesson',
        )
        ContentTranscript.objects.create(
            content=content,
            processed_plain='Certified text for KP snapshot.',
            language='es',
        )
        profile = ContentProfile.objects.create(
            content=content, user=self.admin, title='Lesson',
        )
        Node.objects.create(
            knowledge_path=self.path,
            content_profile=profile,
            title='Lesson',
            description='',
            order=1,
            media_type='VIDEO',
        )
        self.snapshot, _created = publish_knowledge_path_snapshot(
            self.path, published_by=self.admin,
        )

    def test_ensure_pending_builds_acbc2_payload(self):
        anchor = ensure_pending_snapshot_anchor(self.snapshot, anchored_by=self.admin)
        self.assertEqual(anchor.digest, self.snapshot.digest)
        self.assertEqual(anchor.op_return_prefix, 'ACBC2')
        payload = bytes.fromhex(anchor.btc_op_return_hex)
        self.assertTrue(payload.startswith(b'ACBC2'))
        self.assertEqual(len(payload), 5 + 32)
        again = ensure_pending_snapshot_anchor(self.snapshot)
        self.assertEqual(anchor.pk, again.pk)

    def test_blockchain_payload_none_without_anchor(self):
        payload = blockchain_payload_for_snapshot(self.snapshot)
        self.assertEqual(payload['status'], 'none')
        self.assertEqual(payload['digest'], self.snapshot.digest)

    def test_serialize_pending_anchor(self):
        anchor = ensure_pending_snapshot_anchor(self.snapshot)
        payload = serialize_snapshot_anchor(anchor)
        self.assertEqual(payload['status'], 'pending')
        self.assertEqual(payload['digest'], self.snapshot.digest)
        self.assertEqual(payload['opReturnPrefix'], 'ACBC2')
        self.assertTrue(payload['opReturnHex'])


class SnapshotAnchorAPITests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            'api-admin', 'api@example.com', 'pass', is_staff=True,
        )
        self.other = User.objects.create_user('other', 'o@example.com', 'pass')
        self.path = KnowledgePath.objects.create(
            title='API KP',
            description='',
            author=self.admin,
        )
        content = Content.objects.create(
            uploaded_by=self.admin,
            media_type='TEXT',
            original_title='Doc',
        )
        ContentTranscript.objects.create(
            content=content,
            processed_plain='PDF extract text.',
            format='PLAIN',
            language='es',
        )
        profile = ContentProfile.objects.create(
            content=content, user=self.admin, title='Doc',
        )
        Node.objects.create(
            knowledge_path=self.path,
            content_profile=profile,
            title='Doc',
            description='',
            order=1,
            media_type='TEXT',
        )
        self.snapshot, _created = publish_knowledge_path_snapshot(
            self.path, published_by=self.admin,
        )
        self.client = APIClient()

    def test_non_staff_forbidden(self):
        self.client.force_authenticate(user=self.other)
        response = self.client.post(
            f'/api/knowledge_paths/{self.path.id}/snapshots/{self.snapshot.version}/anchor/',
        )
        self.assertEqual(response.status_code, 403)

    @patch('knowledge_paths.views.broadcast_snapshot_anchor')
    @patch('knowledge_paths.views.ensure_pending_snapshot_anchor')
    def test_staff_can_post_anchor(self, mock_ensure, mock_broadcast):
        anchor = KnowledgePathSnapshotAnchor(
            snapshot=self.snapshot,
            digest=self.snapshot.digest,
            status=KnowledgePathSnapshotAnchor.STATUS_BTC_BROADCAST,
            btc_network='signet',
            btc_txid='ee' * 32,
            btc_op_return_hex='4143424332' + '11' * 32,
        )
        anchor.save()
        mock_ensure.return_value = anchor
        mock_broadcast.return_value = anchor

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f'/api/knowledge_paths/{self.path.id}/snapshots/{self.snapshot.version}/anchor/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['blockchain']['status'], 'btc_broadcast')
        self.assertEqual(response.data['blockchain']['txid'], 'ee' * 32)
        self.assertEqual(response.data['digest'], self.snapshot.digest)

    def test_readiness_blockchain_none_without_published(self):
        from knowledge_paths.services.snapshot_preview import (
            knowledge_path_snapshot_readiness,
        )

        empty = KnowledgePath.objects.create(
            title='Empty', description='', author=self.admin,
        )
        payload = knowledge_path_snapshot_readiness(empty)
        self.assertEqual(payload['blockchain']['status'], 'none')
