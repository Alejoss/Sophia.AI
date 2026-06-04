from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from content.models import Content, ContentProfile, FileDetails
from content.youtube_migration_utils import (
    build_migration_filename,
    build_migration_s3_key,
    is_youtube_url,
    parse_content_id_from_migration_filename,
    sanitize_migration_label,
)


class YouTubeMigrationUtilsTests(TestCase):
    def test_is_youtube_url(self):
        self.assertTrue(is_youtube_url('https://www.youtube.com/watch?v=abc'))
        self.assertTrue(is_youtube_url('https://youtu.be/abc'))
        self.assertFalse(is_youtube_url('https://example.com'))

    def test_build_migration_filename_includes_channel_title_and_id(self):
        name = build_migration_filename(
            'Academia Blockchain Channel',
            'Intro to Web3',
            42,
        )
        self.assertTrue(name.endswith('_42.mp4'))
        self.assertIn('Intro', name)
        self.assertLessEqual(len(name), 220)

    def test_parse_content_id_from_filename(self):
        name = build_migration_filename('MyChannel', 'My Title', 99)
        self.assertEqual(parse_content_id_from_migration_filename(name), 99)

    def test_sanitize_migration_label_truncates(self):
        long_name = 'x' * 100
        self.assertEqual(len(sanitize_migration_label(long_name, 10)), 10)


class YouTubeMigrationManifestViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='migration_user',
            email='mig@example.com',
            password='pass',
        )
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='VIDEO',
            original_title='Platform Title',
            url='https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        )
        FileDetails.objects.create(content=self.content)
        self.profile = ContentProfile.objects.create(
            content=self.content,
            user=self.user,
            title='Profile Title',
        )

    @patch('content.youtube_migration_utils.fetch_youtube_channel_from_oembed')
    def test_manifest_open_no_auth(self, mock_channel):
        mock_channel.return_value = 'Test Channel'
        url = f'/api/content/youtube-migration-manifest/?user_id={self.user.id}'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['item_count'], 1)
        item = response.data['items'][0]
        self.assertEqual(item['content_id'], self.content.id)
        self.assertEqual(item['youtube_channel'], 'Test Channel')
        self.assertTrue(item['suggested_local_filename'].endswith(f'_{self.content.id}.mp4'))
        self.assertIn('Test_Channel', item['suggested_local_filename'])
        self.assertIn(str(self.content.id), item['suggested_s3_key'])

    def test_manifest_requires_user_id(self):
        response = self.client.get('/api/content/youtube-migration-manifest/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_manifest_excludes_non_youtube(self):
        other = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Blog',
            url='https://example.com/article',
        )
        ContentProfile.objects.create(content=other, user=self.user, title='Blog')
        response = self.client.get(
            f'/api/content/youtube-migration-manifest/?user_id={self.user.id}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['item_count'], 1)

    def test_manifest_skips_items_with_file(self):
        fd = self.content.file_details
        fd.file = 'content_owner_attach/1/1/video.mp4'
        fd.save()
        with patch('content.youtube_migration_utils.fetch_youtube_channel_from_oembed') as mock_channel:
            mock_channel.return_value = 'Ch'
            response = self.client.get(
                f'/api/content/youtube-migration-manifest/?user_id={self.user.id}'
            )
        item = response.data['items'][0]
        self.assertTrue(item['has_file'])
        self.assertFalse(item['can_attach_file'])
