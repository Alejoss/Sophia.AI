import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from events.models import FeaturedEvent
from tests.factories.events import EventFactory
from tests.factories.users import UserFactory


def wide_banner(name='banner.jpg'):
    buffer = io.BytesIO()
    Image.new('RGB', (1600, 280), color=(18, 22, 48)).save(buffer, format='JPEG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/jpeg')


class FeaturedEventAPITest(APITestCase):
    def setUp(self):
        self.owner = UserFactory()
        self.other = UserFactory()
        self.staff = UserFactory(is_staff=True)
        self.event = EventFactory(owner=self.owner, is_visible=True)
        self.feature_url = reverse('events:event-feature', args=[self.event.id])
        self.current_url = reverse('events:event-featured-current')

    def _publish(self, user, event=None, active='true'):
        self.client.force_authenticate(user=user)
        return self.client.put(
            reverse('events:event-feature', args=[(event or self.event).id]),
            {'is_active': active, 'image': wide_banner()},
            format='multipart',
        )

    def test_owner_publishes_a_wide_banner(self):
        response = self._publish(self.owner)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['event_id'], self.event.id)
        self.assertTrue(response.data['is_active'])
        self.assertTrue(response.data['image'])
        self.assertEqual(FeaturedEvent.objects.filter(event=self.event, is_active=True).count(), 1)

    def test_publishing_one_banner_retires_the_previous(self):
        first = EventFactory(owner=self.owner, is_visible=True)
        self._publish(self.owner, event=first)
        response = self._publish(self.owner, event=self.event)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(FeaturedEvent.objects.get(event=first).is_active)
        self.assertTrue(FeaturedEvent.objects.get(event=self.event).is_active)

    def test_public_banner_is_the_active_visible_event(self):
        self._publish(self.owner)
        self.client.force_authenticate(user=None)

        response = self.client.get(self.current_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['event_id'], self.event.id)
        self.assertEqual(response.data['path'], f'/events/{self.event.id}')
        self.assertEqual(response.data['title'], self.event.title)

    def test_private_or_ended_event_is_not_advertised(self):
        self._publish(self.owner)
        self.event.is_visible = False
        self.event.save()
        self.client.force_authenticate(user=None)
        hidden = self.client.get(self.current_url)
        self.assertIsNone(hidden.data)

        self.event.is_visible = True
        self.event.date_start = timezone.now() - timezone.timedelta(days=3)
        self.event.date_start_has_time = True
        self.event.date_end = timezone.now() - timezone.timedelta(days=1)
        self.event.date_end_has_time = True
        self.event.save()
        ended = self.client.get(self.current_url)
        self.assertIsNone(ended.data)

    def test_inactive_banner_is_hidden(self):
        self._publish(self.owner)
        placement = FeaturedEvent.objects.get(event=self.event)
        placement.is_active = False
        placement.save()
        self.client.force_authenticate(user=None)

        response = self.client.get(self.current_url)

        self.assertIsNone(response.data)

    def test_other_user_cannot_upload(self):
        response = self._publish(self.other)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(FeaturedEvent.objects.exists())

    def test_staff_can_feature_another_users_event(self):
        response = self._publish(self.staff)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['event_id'], self.event.id)

    def test_active_banner_requires_an_image(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.put(
            self.feature_url,
            {'is_active': 'true'},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('image', response.data)

    def test_owner_can_turn_the_banner_off(self):
        self._publish(self.owner)
        self.client.force_authenticate(user=self.owner)
        response = self.client.put(self.feature_url, {'is_active': 'false'}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_active'])
        self.client.force_authenticate(user=None)
        self.assertIsNone(self.client.get(self.current_url).data)
