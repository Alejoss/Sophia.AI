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

    def test_search_filters_by_content_ids(self):
        session = MagicMock()
        session.request.return_value = _ok_response({'result': []})
        client = QdrantClient(session=session)

        client.search([0.1, 0.2], topic_id=2, content_ids=[46, 88], limit=4)

        body = session.request.call_args.kwargs['json']
        must = body['filter']['must']
        self.assertEqual(must[0], {'key': 'topic_id', 'match': {'value': 2}})
        self.assertEqual(must[1], {'key': 'content_id', 'match': {'any': [46, 88]}})

    def test_search_with_empty_content_ids_skips_request(self):
        session = MagicMock()
        client = QdrantClient(session=session)
        self.assertEqual(client.search([0.1], topic_id=2, content_ids=[]), [])
        session.request.assert_not_called()
