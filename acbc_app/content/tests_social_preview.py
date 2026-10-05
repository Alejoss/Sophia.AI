"""Tests for Open Graph social preview HTML served to Telegram/etc. crawlers."""
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from content.models import Collection, Content, ContentProfile, FileDetails, Library, Topic


TINY_PNG = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
    b'\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00'
    b'\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
)


@override_settings(FRONTEND_PUBLIC_URL='https://www.academiablockchain.com')
class ContentSocialPreviewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='oguser',
            email='og@example.com',
            password='testpass123',
        )
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='VIDEO',
            original_title='7 Errores Peligrosos',
            original_author='Alejandro Veintimilla',
        )
        self.file_details = FileDetails.objects.create(
            content=self.content,
            og_description='En este video hablo sobre Durov.',
            og_image='https://cdn.example.com/covers/durov.jpg',
        )
        self.library = Library.objects.create(user=self.user, name='My Library')
        self.public_collection = Collection.objects.create(
            library=self.library,
            name='Public Shelf',
            is_public=True,
        )
        self.profile = ContentProfile.objects.create(
            content=self.content,
            user=self.user,
            collection=self.public_collection,
            title='Durov en ACBC',
            author='Alejandro Veintimilla',
            is_visible=True,
        )

    def test_content_social_preview_includes_og_tags(self):
        url = reverse('content:social-preview-content', args=[self.content.id])
        response = self.client.get(url, {'context': 'library', 'id': self.user.id})
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn('property="og:title"', html)
        self.assertIn('Durov en ACBC', html)
        self.assertIn('property="og:description"', html)
        self.assertIn('En este video hablo sobre Durov.', html)
        self.assertIn('property="og:image"', html)
        self.assertIn('https://cdn.example.com/covers/durov.jpg', html)
        self.assertIn('property="og:site_name"', html)
        self.assertIn('Academia Blockchain', html)
        self.assertIn('name="twitter:card"', html)
        self.assertIn('summary_large_image', html)
        self.assertIn(
            'https://www.academiablockchain.com/content/'
            f'{self.content.id}/library?context=library&amp;id={self.user.id}',
            html,
        )

    def test_content_social_preview_uses_profile_thumbnail_over_og_image(self):
        self.profile.thumbnail.save(
            'thumb.png',
            SimpleUploadedFile('thumb.png', TINY_PNG, content_type='image/png'),
            save=True,
        )
        url = reverse('content:social-preview-content', args=[self.content.id])
        response = self.client.get(url, {'context': 'library', 'id': self.user.id})
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn('/media/', html)
        self.assertNotIn('https://cdn.example.com/covers/durov.jpg', html)

    def test_content_social_preview_hides_private_library_profile_title(self):
        other = User.objects.create_user(
            username='privateowner',
            email='private@example.com',
            password='testpass123',
        )
        private_library = Library.objects.create(user=other, name='Private')
        private_collection = Collection.objects.create(
            library=private_library,
            name='Secret',
            is_public=False,
        )
        ContentProfile.objects.create(
            content=self.content,
            user=other,
            collection=private_collection,
            title='Secret Private Title',
            is_visible=True,
        )
        url = reverse('content:social-preview-content', args=[self.content.id])
        response = self.client.get(url, {'context': 'library', 'id': other.id})
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertNotIn('Secret Private Title', html)
        self.assertIn('7 Errores Peligrosos', html)

    def test_content_social_preview_missing_content_returns_site_fallback(self):
        url = reverse('content:social-preview-content', args=[999999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)
        html = response.content.decode()
        self.assertIn('Academia Blockchain', html)
        self.assertIn('property="og:image"', html)
        self.assertIn('/images/home_hero_brand_v2.png', html)

    def test_topic_social_preview_includes_title_and_description(self):
        topic = Topic.objects.create(
            title='Bitcoin y privacidad',
            description='Un tema sobre Durov y Telegram.',
            creator=self.user,
            is_public=True,
        )
        url = reverse('content:social-preview-topic', args=[topic.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn('Bitcoin y privacidad', html)
        self.assertIn('Un tema sobre Durov y Telegram.', html)
        self.assertIn(f'/content/topics/{topic.id}', html)

    def test_private_topic_social_preview_falls_back(self):
        topic = Topic.objects.create(
            title='Tema secreto',
            description='No public',
            creator=self.user,
            is_public=False,
        )
        url = reverse('content:social-preview-topic', args=[topic.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)
        html = response.content.decode()
        self.assertNotIn('Tema secreto', html)

    def test_site_social_preview(self):
        url = reverse('content:social-preview-site')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn('property="og:title"', html)
        self.assertIn('Academia Blockchain', html)
