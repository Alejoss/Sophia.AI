from unittest.mock import MagicMock, patch

import requests
from django.test import SimpleTestCase, override_settings

from utils.qdrant_client import QdrantClient, QdrantClientError


def _ok_response(payload):
    response = MagicMock()
    response.status_code = 200
    response.content = b'{"result": true}'
    response.json.return_value = payload
    return response


@override_settings(
    QDRANT_URL='https://qdrant.example',
    QDRANT_API_KEY='test-qdrant-key',
    QDRANT_COLLECTION='sophia_acbc_topic_chunks',
)
class QdrantClientRetryTests(SimpleTestCase):
    def test_retries_connection_reset_then_succeeds(self):
        reset = requests.ConnectionError(
            ('Connection aborted.', ConnectionResetError(104, 'Connection reset by peer'))
        )
        session = MagicMock()
        session.request.side_effect = [reset, _ok_response({'result': []})]
        client = QdrantClient(session=session)

        with patch('utils.qdrant_client.time.sleep'):
            data = client.search([0.1, 0.2], topic_id=2, limit=4)

        self.assertEqual(data, [])
        self.assertEqual(session.request.call_count, 2)

    def test_exhausted_connection_errors_become_qdrant_client_error(self):
        reset = requests.ConnectionError(
            ('Connection aborted.', ConnectionResetError(104, 'Connection reset by peer'))
        )
        session = MagicMock()
        session.request.side_effect = reset
        client = QdrantClient(session=session)

        with patch('utils.qdrant_client.time.sleep'):
            with self.assertRaises(QdrantClientError) as ctx:
                client.search([0.1], topic_id=2)

        self.assertIsInstance(ctx.exception.__cause__, requests.ConnectionError)
        self.assertIn('No se pudo conectar a Qdrant', str(ctx.exception))
        self.assertEqual(session.request.call_count, 3)
