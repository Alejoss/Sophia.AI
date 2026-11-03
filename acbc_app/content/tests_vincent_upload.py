from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from content.models import Content, ContentProfile, FileDetails, Topic

VINCENT_SETTINGS = dict(
    VINCENT_API_KEY='vincent-general-key',
    TRANSCRIPT_INGEST_API_KEY='legacy-ingest-key',
    AWS_ACCESS_KEY_ID='test',
    AWS_SECRET_ACCESS_KEY='test',
    AWS_STORAGE_BUCKET_NAME='test-bucket',
    AWS_S3_REGION_NAME='us-west-2',
)


@override_settings(**VINCENT_SETTINGS)
class VincentTopicUploadAPITests(APITestCase):
    def setUp(self):
        self.actor = User.objects.create_user(
            username='operator',
            email='operator@example.com',
            password='testpass123',
        )
        self.other = User.objects.create_user(
            username='other',
            email='other@example.com',
            password='testpass123',
        )
        self.topic = Topic.objects.create(
            title='Tema de Vincent',
            description='Publicaciones del worker',
            creator=self.actor,
        )
        self.foreign_topic = Topic.objects.create(
            title='Tema ajeno',
            description='Sin permiso',
            creator=self.other,
        )
        self.presign_url = reverse('content:vincent-topic-upload-presign', args=[self.topic.id])
        self.confirm_url = reverse('content:vincent-topic-upload-confirm', args=[self.topic.id])
        self.auth = {'HTTP_X_VINCENT_KEY': 'vincent-general-key'}

    def test_presign_requires_vincent_key(self):
        response = self.client.post(
            self.presign_url,
            {'filename': 'nota.pdf', 'file_size': 12, 'media_type': 'TEXT'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_legacy_ingest_key_is_rejected_when_general_key_is_set(self):
        response = self.client.post(
            self.presign_url,
            {'filename': 'nota.pdf', 'file_size': 12, 'media_type': 'TEXT'},
            format='json',
            HTTP_X_TRANSCRIPT_INGEST_KEY='legacy-ingest-key',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('content.views_vincent_upload._build_s3_upload_plan')
    @patch('content.views_vincent_upload.boto3.client')
    def test_presign_uses_actor_user_prefix(self, mock_boto_client, mock_build_plan):
        mock_boto_client.return_value = Mock()
        mock_build_plan.return_value = {
            'upload_mode': 'single',
            'upload_url': 'https://example.com/upload',
            'key': f'content/document/{self.actor.id}/abc_nota.pdf',
        }
        with override_settings(VINCENT_ACTOR_USER_ID=self.actor.id):
            response = self.client.post(
                self.presign_url,
                {
                    'filename': 'nota.pdf',
                    'file_size': 12,
                    'content_type': 'application/pdf',
                    'media_type': 'TEXT',
                },
                format='json',
                **self.auth,
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        key = mock_build_plan.call_args.kwargs['key']
        self.assertTrue(key.startswith(f'content/document/{self.actor.id}/'))
        self.assertTrue(key.endswith('_nota.pdf'))
        self.assertEqual(response.data['topic_id'], self.topic.id)

    def test_presign_rejects_topic_the_actor_does_not_moderate(self):
        with override_settings(VINCENT_ACTOR_USER_ID=self.actor.id):
            response = self.client.post(
                reverse('content:vincent-topic-upload-presign', args=[self.foreign_topic.id]),
                {'filename': 'nota.pdf', 'file_size': 12, 'media_type': 'TEXT'},
                format='json',
                **self.auth,
            )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('content.views_vincent_upload.boto3.client')
    def test_confirm_creates_profile_for_actor_and_attaches_topic(self, mock_boto_client):
        s3_client = Mock()
        s3_client.head_object.return_value = {}
        mock_boto_client.return_value = s3_client
        key = f'content/document/{self.actor.id}/abc_nota.pdf'
        with override_settings(VINCENT_ACTOR_USER_ID=self.actor.id):
            response = self.client.post(
                self.confirm_url,
                {
                    'key': key,
                    'media_type': 'TEXT',
                    'title': 'Nota local',
                    'file_size': 12,
                },
                format='json',
                **self.auth,
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        content = Content.objects.get(pk=response.data['content_id'])
        profile = ContentProfile.objects.get(pk=response.data['content_profile_id'])
        self.assertEqual(content.uploaded_by_id, self.actor.id)
        self.assertEqual(profile.user_id, self.actor.id)
        self.assertEqual(profile.title, 'Nota local')
        self.assertIn(content, self.topic.contents.all())
        self.assertEqual(FileDetails.objects.get(content=content).file.name, key)

    @patch('content.views_vincent_upload.boto3.client')
    def test_confirm_again_does_not_duplicate_and_keeps_topic_link(self, mock_boto_client):
        s3_client = Mock()
        s3_client.head_object.return_value = {}
        mock_boto_client.return_value = s3_client
        payload = {
            'key': f'content/document/{self.actor.id}/abc_nota.pdf',
            'media_type': 'TEXT',
            'title': 'Nota local',
            'file_size': 12,
        }
        with override_settings(VINCENT_ACTOR_USER_ID=self.actor.id):
            first = self.client.post(self.confirm_url, payload, format='json', **self.auth)
            second = self.client.post(self.confirm_url, payload, format='json', **self.auth)
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(Content.objects.count(), 1)
        self.assertEqual(second.data['content_id'], first.data['content_id'])
        self.assertEqual(second.data['content_profile_id'], first.data['content_profile_id'])


@override_settings(VINCENT_API_KEY='vincent-general-key', TRANSCRIPT_INGEST_API_KEY='')
class VincentKeyOnIngestAPITests(APITestCase):
    def test_transcript_queue_accepts_general_vincent_key(self):
        response = self.client.get(
            '/api/content/transcript-ingest/',
            HTTP_X_VINCENT_KEY='vincent-general-key',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)
