"""Tests for Vincent knowledge-path ingest detail API."""

from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from content.models import Content, ContentEmbedding, ContentProfile, ContentTranscript
from knowledge_paths.models import KnowledgePath, Node


@override_settings(TRANSCRIPT_INGEST_API_KEY='test-kp-ingest-key')
class KnowledgePathIngestDetailAPITests(APITestCase):
    def setUp(self):
        self.author = User.objects.create_user(
            username='kp-author',
            email='kp-author@example.com',
            password='testpass123',
        )
        self.path = KnowledgePath.objects.create(
            title='Path for Vincent',
            description='Detail endpoint fixture',
            author=self.author,
            is_visible=True,
        )
        self.video = Content.objects.create(
            uploaded_by=self.author,
            media_type='VIDEO',
            original_title='Video node content',
        )
        self.profile = ContentProfile.objects.create(
            content=self.video,
            user=self.author,
            title='Video profile',
        )
        self.node = Node.objects.create(
            knowledge_path=self.path,
            content_profile=self.profile,
            title='Node one',
            description='First lesson',
            order=1,
            media_type='VIDEO',
        )
        self.auth_header = {'HTTP_X_TRANSCRIPT_INGEST_KEY': 'test-kp-ingest-key'}
        self.url = f'/api/content/knowledge-path-ingest/{self.path.id}/'

    def test_requires_ingest_key(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_rejects_wrong_key(self):
        response = self.client.get(
            self.url,
            HTTP_X_TRANSCRIPT_INGEST_KEY='wrong-key',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_404_for_unknown_path(self):
        response = self.client.get(
            '/api/content/knowledge-path-ingest/999999/',
            **self.auth_header,
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_detail_without_transcript(self):
        response = self.client.get(self.url, **self.auth_header)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.path.id)
        self.assertEqual(
            response.data['knowledge_path_id'],
            f'sophia-acbc:knowledge-path:{self.path.id}',
        )
        self.assertEqual(response.data['author_username'], 'kp-author')
        self.assertEqual(len(response.data['nodes']), 1)
        node = response.data['nodes'][0]
        self.assertEqual(node['id'], self.node.id)
        self.assertEqual(node['node_id'], f'sophia-acbc:node:{self.node.id}')
        self.assertEqual(node['position'], 1)
        self.assertEqual(node['content']['id'], self.video.id)
        self.assertFalse(node['content']['has_transcript'])
        self.assertFalse(node['has_certified_text'])
        self.assertIsNone(node['content']['embedding_status'])
        summary = response.data['summary']
        self.assertEqual(summary['node_count'], 1)
        self.assertEqual(summary['nodes_with_content'], 1)
        self.assertEqual(summary['nodes_with_transcript'], 0)
        self.assertNotIn('nodes_embedding_needing_work', summary)
        self.assertFalse(summary['ready_for_strict_publish'])

    def test_detail_with_transcript_and_embedding(self):
        transcript = ContentTranscript.objects.create(
            content=self.video,
            processed_plain='Bitcoin is peer-to-peer electronic cash.',
            language='en',
        )
        ContentEmbedding.objects.update_or_create(
            content=self.video,
            defaults={
                'status': ContentEmbedding.STATUS_INDEXED,
                'source_hash': transcript.text_hash,
                'model': 'text-embedding-3-large',
                'dims': 3072,
                'chunk_count': 1,
            },
        )

        response = self.client.get(self.url, **self.auth_header)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        node = response.data['nodes'][0]
        self.assertTrue(node['content']['has_transcript'])
        self.assertTrue(node['has_certified_text'])
        self.assertEqual(node['content']['text_hash'], transcript.text_hash)
        self.assertEqual(node['content']['embedding_status'], 'indexed')
        self.assertEqual(node['content']['chunk_count'], 1)
        summary = response.data['summary']
        self.assertEqual(summary['nodes_with_transcript'], 1)
        self.assertEqual(summary['nodes_with_certified_text'], 1)
        self.assertEqual(summary['nodes_embedding_indexed'], 1)
        self.assertNotIn('nodes_embedding_needing_work', summary)
        self.assertTrue(summary['ready_for_strict_publish'])

    def test_accepts_bearer_auth(self):
        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION='Bearer test-kp-ingest-key',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_node_without_content_profile(self):
        Node.objects.create(
            knowledge_path=self.path,
            content_profile=None,
            title='Empty node',
            description='',
            order=2,
            media_type='TEXT',
        )
        response = self.client.get(self.url, **self.auth_header)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['nodes']), 2)
        empty = response.data['nodes'][1]
        self.assertIsNone(empty['content'])
        self.assertIsNone(empty['content_profile_id'])
        self.assertFalse(empty['has_certified_text'])
        self.assertFalse(response.data['summary']['ready_for_strict_publish'])
