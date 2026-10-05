"""Tests for Open Graph social preview HTML served to Telegram/etc. crawlers."""
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from content.models import Collection, Content, ContentProfile, FileDetails, Library, Topic
from events.models import Event
from knowledge_paths.models import KnowledgePath


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

    def test_content_social_preview_prefers_thumbnail_preview_over_og_image(self):
        self.profile.thumbnail_preview.save(
            'preview.webp',
            SimpleUploadedFile('preview.webp', TINY_PNG, content_type='image/webp'),
            save=True,
        )
        url = reverse('content:social-preview-content', args=[self.content.id])
        response = self.client.get(url, {'context': 'library', 'id': self.user.id})
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.profile.refresh_from_db()
        self.assertIn(self.profile.thumbnail_preview.url, html)
        self.assertNotIn('https://cdn.example.com/covers/durov.jpg', html)

    def test_content_social_preview_prefers_preview_over_full_thumbnail(self):
        self.profile.thumbnail.save(
            'full.png',
            SimpleUploadedFile('full.png', TINY_PNG, content_type='image/png'),
            save=True,
        )
        self.profile.thumbnail_preview.save(
            'listing-preview.webp',
            SimpleUploadedFile('listing-preview.webp', TINY_PNG, content_type='image/webp'),
            save=True,
        )
        url = reverse('content:social-preview-content', args=[self.content.id])
        response = self.client.get(url, {'context': 'library', 'id': self.user.id})
        html = response.content.decode()
        self.profile.refresh_from_db()
        self.assertIn(self.profile.thumbnail_preview.url, html)
        self.assertNotIn(self.profile.thumbnail.url, html)

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
        topic.topic_image.save(
            'cover.png',
            SimpleUploadedFile('cover.png', TINY_PNG, content_type='image/png'),
            save=True,
        )
        topic.topic_image_thumbnail.save(
            'cover-thumb.webp',
            SimpleUploadedFile('cover-thumb.webp', TINY_PNG, content_type='image/webp'),
            save=True,
        )
        url = reverse('content:social-preview-topic', args=[topic.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn('Bitcoin y privacidad', html)
        self.assertIn('Un tema sobre Durov y Telegram.', html)
        self.assertIn('topic_image_thumb', html)
        self.assertNotIn('topic_image.png', html)
        self.assertIn(f'/content/topics/{topic.id}', html)

    def test_knowledge_path_social_preview_uses_image_preview(self):
        path = KnowledgePath.objects.create(
            title='Camino Ucronía',
            description='Ruta de lectura guiada.',
            author=self.user,
            is_visible=True,
        )
        path.image.save(
            'cover.jpg',
            SimpleUploadedFile('cover.jpg', TINY_PNG, content_type='image/jpeg'),
            save=True,
        )
        path.image_preview.save(
            'cover-preview.webp',
            SimpleUploadedFile('cover-preview.webp', TINY_PNG, content_type='image/webp'),
            save=True,
        )
        url = reverse('knowledge_paths:knowledge-path-social-preview', args=[path.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn('Camino Ucronía', html)
        self.assertIn('_preview', html)
        self.assertNotIn('path_1_cover', html)
        self.assertIn(f'/knowledge_path/{path.id}', html)

    def test_event_social_preview_uses_event_image(self):
        event = Event.objects.create(
            owner=self.user,
            title='Conferencia Bitcoin',
            description='Evento en vivo.',
            is_visible=True,
        )
        event.image.save(
            'event.jpg',
            SimpleUploadedFile('event.jpg', TINY_PNG, content_type='image/jpeg'),
            save=True,
        )
        url = reverse('events:event-social-preview', args=[event.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn('Conferencia Bitcoin', html)
        self.assertIn('event_pictures/', html)
        self.assertIn(f'/events/{event.id}', html)

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
