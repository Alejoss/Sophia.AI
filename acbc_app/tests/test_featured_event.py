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


def banner_file(name='desktop.jpg', size=(1600, 280)):
    buffer = io.BytesIO()
    Image.new('RGB', size, color=(18, 22, 48)).save(buffer, format='JPEG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/jpeg')


def both_banners():
    return {
        'desktop_image': banner_file('desktop.jpg', (1600, 280)),
        'mobile_image': banner_file('mobile.jpg', (1200, 500)),
    }


class FeaturedEventAPITest(APITestCase):
    def setUp(self):
        self.owner = UserFactory()
        self.staff = UserFactory(is_staff=True)
        self.event = EventFactory(owner=self.owner, is_visible=True)
        self.detail_url = reverse('events:admin-featured-event-detail', args=[self.event.id])
        self.current_url = reverse('events:event-featured-current')

    def _publish(self, user=None, event=None, active='true', **images):
        self.client.force_authenticate(user=user or self.staff)
        payload = {'is_active': active, **(images or both_banners())}
        return self.client.put(
            reverse('events:admin-featured-event-detail', args=[(event or self.event).id]),
            payload,
            format='multipart',
        )

    def test_staff_publishes_desktop_and_mobile_banners(self):
        response = self._publish()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['event_id'], self.event.id)
        self.assertTrue(response.data['is_active'])
        self.assertTrue(response.data['is_live'])
        self.assertIn('_desktop_', response.data['desktop_image'])
        self.assertIn('_mobile_', response.data['mobile_image'])
        self.assertEqual(FeaturedEvent.objects.filter(event=self.event, is_active=True).count(), 1)

    def test_event_owner_cannot_manage_the_banner(self):
        response = self._publish(user=self.owner)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(FeaturedEvent.objects.exists())

        self.client.force_authenticate(user=self.owner)
        self.assertEqual(self.client.get(self.detail_url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.client.get(reverse('events:admin-featured-events')).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_banner_needs_both_images(self):
        response = self._publish(desktop_image=banner_file())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('mobile_image', response.data)
        self.assertNotIn('desktop_image', response.data)

        response = self._publish(active='false', mobile_image=banner_file('m.jpg', (1200, 500)))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('desktop_image', response.data)
        self.assertFalse(FeaturedEvent.objects.exists())

    def test_one_image_can_be_replaced_alone(self):
        self._publish()
        old_desktop = FeaturedEvent.objects.get(event=self.event).desktop_image.name

        response = self._publish(mobile_image=banner_file('new-mobile.jpg', (1200, 500)))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        placement = FeaturedEvent.objects.get(event=self.event)
        self.assertEqual(placement.desktop_image.name, old_desktop)
        self.assertIn('_mobile_', placement.mobile_image.name)

    def test_publishing_one_banner_retires_the_previous(self):
        first = EventFactory(owner=self.owner, is_visible=True)
        self._publish(event=first)
        response = self._publish(event=self.event)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(FeaturedEvent.objects.get(event=first).is_active)
        self.assertTrue(FeaturedEvent.objects.get(event=self.event).is_active)

    def test_public_banner_returns_both_images(self):
        self._publish()
        self.client.force_authenticate(user=None)

        response = self.client.get(self.current_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['event_id'], self.event.id)
        self.assertEqual(response.data['path'], f'/events/{self.event.id}')
        self.assertEqual(response.data['title'], self.event.title)
        self.assertTrue(response.data['desktop_image'])
        self.assertTrue(response.data['mobile_image'])

    def test_banner_without_a_mobile_image_is_not_shown(self):
        self._publish()
        placement = FeaturedEvent.objects.get(event=self.event)
        placement.mobile_image = ''
        placement.save()
        self.client.force_authenticate(user=None)

        self.assertIsNone(self.client.get(self.current_url).data)

    def test_private_or_ended_event_is_not_advertised(self):
        self._publish()
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

    def test_started_event_keeps_its_banner_until_it_ends(self):
        self.event.date_start = timezone.now() - timezone.timedelta(days=2)
        self.event.date_start_has_time = True
        self.event.date_end = timezone.now() + timezone.timedelta(days=5)
        self.event.date_end_has_time = True
        self.event.save()
        self._publish()
        self.client.force_authenticate(user=None)

        response = self.client.get(self.current_url)

        self.assertEqual(response.data['event_id'], self.event.id)

    def test_event_without_an_end_date_stops_after_its_start_day(self):
        self.event.date_start = timezone.now() - timezone.timedelta(days=2)
        self.event.date_start_has_time = True
        self.event.date_end = None
        self.event.save()
        self._publish()
        self.client.force_authenticate(user=None)
        self.assertIsNone(self.client.get(self.current_url).data)

        self.event.date_start = timezone.now()
        self.event.save()
        self.assertEqual(self.client.get(self.current_url).data['event_id'], self.event.id)

    def test_staff_can_turn_the_banner_off(self):
        self._publish()
        self.client.force_authenticate(user=self.staff)
        response = self.client.put(self.detail_url, {'is_active': 'false'}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_active'])
        self.client.force_authenticate(user=None)
        self.assertIsNone(self.client.get(self.current_url).data)

    def test_staff_can_delete_a_banner(self):
        self._publish()
        self.client.force_authenticate(user=self.staff)

        response = self.client.delete(self.detail_url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(FeaturedEvent.objects.exists())

    def test_admin_list_marks_the_live_banner(self):
        other = EventFactory(owner=self.owner, is_visible=True)
        self._publish(event=other)
        self._publish(event=self.event)
        self.client.force_authenticate(user=self.staff)

        response = self.client.get(reverse('events:admin-featured-events'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']
        self.assertEqual([row['event_id'] for row in results], [self.event.id, other.id])
        self.assertTrue(results[0]['is_live'])
        self.assertFalse(results[1]['is_live'])

    def test_event_choices_list_upcoming_first_and_flag_private_or_ended(self):
        now = timezone.now()
        self.event.date_start = now + timezone.timedelta(days=10)
        self.event.date_start_has_time = True
        self.event.date_end = None
        self.event.save()
        sooner = EventFactory(
            owner=self.owner,
            is_visible=False,
            title='Privado',
            date_start=now + timezone.timedelta(days=2),
            date_start_has_time=True,
            date_end=None,
        )
        ended = EventFactory(
            owner=self.owner,
            is_visible=True,
            title='Terminado',
            date_start=now - timezone.timedelta(days=3),
            date_start_has_time=True,
            date_end=now - timezone.timedelta(days=1),
            date_end_has_time=True,
        )
        self._publish()
        self.client.force_authenticate(user=self.staff)

        response = self.client.get(reverse('events:admin-featured-event-choices'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = response.data['results']
        self.assertEqual([row['id'] for row in rows], [sooner.id, self.event.id, ended.id])
        self.assertFalse(rows[0]['is_visible'])
        self.assertTrue(rows[1]['has_banner'])
        self.assertTrue(rows[2]['has_ended'])
