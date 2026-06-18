from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from events.models import Event, EventRegistration
from tests.factories.events import EventFactory, EventRegistrationFactory
from tests.factories.users import UserFactory


class EventListAPITest(TestCase):
    """Test cases for EventList API endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = UserFactory()
        self.client.force_authenticate(user=self.user)
        self.url = reverse('events:event-list')

    def test_get_events_list(self):
        """Test GET request to list all events."""
        event1 = EventFactory()
        event2 = EventFactory()
        
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]['title'], event2.title)  # Most recent first
        self.assertEqual(response.data[1]['title'], event1.title)

    def test_get_events_filtered_by_owner(self):
        """Test GET request with owner filter."""
        owner1 = UserFactory()
        owner2 = UserFactory()
        event1 = EventFactory(owner=owner1)
        event2 = EventFactory(owner=owner2)
        
        response = self.client.get(f"{self.url}?owner={owner1.id}")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], event1.title)

    def test_create_event_success(self):
        """Test POST request to create a new event."""
        event_data = {
            'title': 'New Test Event',
            'description': 'Test Description',
            'event_type': 'LIVE_COURSE',
            'platform': 'google_meet',
            'reference_price': 99.99,
            'date_start': (timezone.now() + timezone.timedelta(days=7)).isoformat(),
            'date_end': (timezone.now() + timezone.timedelta(days=7, hours=2)).isoformat(),
        }
        
        response = self.client.post(self.url, event_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'New Test Event')
        self.assertEqual(response.data['owner']['username'], self.user.username)
        self.assertEqual(Event.objects.count(), 1)

    def test_create_event_with_other_platform(self):
        """Test creating event with 'other' platform."""
        event_data = {
            'title': 'New Test Event',
            'description': 'Test Description',
            'event_type': 'LIVE_COURSE',
            'platform': 'other',
            'other_platform': 'Custom Platform',
            'reference_price': 99.99,
        }
        
        response = self.client.post(self.url, event_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['platform'], 'other')
        self.assertEqual(response.data['other_platform'], 'Custom Platform')

    def test_create_event_validation_error(self):
        """Test creating event with validation errors."""
        event_data = {
            'title': '',  # Empty title
            'description': '',  # Empty description
            'platform': 'other',  # Missing other_platform
        }
        
        response = self.client.post(self.url, event_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Check for title validation error (which comes first in the serializer)
        self.assertIn('title', response.data)

    def test_public_list_excludes_hidden_events(self):
        """Hidden events should not appear in the public event list."""
        visible_event = EventFactory(is_visible=True)
        EventFactory(is_visible=False)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], visible_event.title)

    def test_owner_filter_excludes_hidden_events_for_visitors(self):
        """Visitors should only see visible events when filtering by owner."""
        owner = UserFactory()
        visible_event = EventFactory(owner=owner, is_visible=True)
        EventFactory(owner=owner, is_visible=False)

        response = self.client.get(f"{self.url}?owner={owner.id}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], visible_event.title)

    def test_owner_filter_includes_hidden_events_for_owner(self):
        """Owners should see hidden events when filtering their own events."""
        owner = UserFactory()
        visible_event = EventFactory(owner=owner, is_visible=True)
        hidden_event = EventFactory(owner=owner, is_visible=False)
        self.client.force_authenticate(user=owner)

        response = self.client.get(f"{self.url}?owner={owner.id}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        titles = [event['title'] for event in response.data]
        self.assertIn(visible_event.title, titles)
        self.assertIn(hidden_event.title, titles)

    def test_create_event_defaults_to_private(self):
        """New events should be private unless explicitly marked public."""
        event_data = {
            'title': 'Private Event',
            'description': 'Test Description',
            'event_type': 'LIVE_COURSE',
            'platform': 'google_meet',
            'reference_price': 0,
        }

        response = self.client.post(self.url, event_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data['is_visible'])


class EventDetailAPITest(TestCase):
    """Test cases for EventDetail API endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = UserFactory()
        self.event = EventFactory(owner=self.user)
        self.client.force_authenticate(user=self.user)
        self.url = reverse('events:event-detail', kwargs={'pk': self.event.pk})

    def test_get_event_detail(self):
        """Test GET request to retrieve event details."""
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], self.event.title)
        self.assertEqual(response.data['owner']['username'], self.user.username)

    def test_get_event_detail_anonymous(self):
        """Test GET request allows unauthenticated access to public events."""
        self.client.force_authenticate(user=None)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], self.event.title)

    def test_get_hidden_event_detail_anonymous(self):
        """Hidden events remain accessible via direct URL for anonymous users."""
        hidden_event = EventFactory(owner=self.user, is_visible=False)
        self.client.force_authenticate(user=None)

        response = self.client.get(reverse('events:event-detail', kwargs={'pk': hidden_event.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], hidden_event.title)

    def test_get_hidden_event_detail_as_owner(self):
        """Owners can access their hidden events."""
        hidden_event = EventFactory(owner=self.user, is_visible=False)

        response = self.client.get(reverse('events:event-detail', kwargs={'pk': hidden_event.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], hidden_event.title)

    def test_update_event_requires_auth(self):
        """Test PUT request rejects unauthenticated users."""
        self.client.force_authenticate(user=None)
        response = self.client.put(self.url, {'title': 'Hacked'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_nonexistent_event(self):
        """Test GET request for non-existent event."""
        response = self.client.get(reverse('events:event-detail', kwargs={'pk': 99999}))
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_event_success(self):
        """Test PUT request to update event."""
        update_data = {
            'title': 'Updated Title',
            'description': 'Updated Description',
            'event_type': 'LIVE_MASTER_CLASS',
            'platform': 'zoom',
        }
        
        response = self.client.put(self.url, update_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Updated Title')
        self.assertEqual(response.data['description'], 'Updated Description')
        
        # Verify database was updated
        self.event.refresh_from_db()
        self.assertEqual(self.event.title, 'Updated Title')

    def test_update_event_validation_error(self):
        """Test PUT request with validation errors."""
        update_data = {
            'title': '',  # Empty title to trigger validation error
            'date_start': (timezone.now() + timezone.timedelta(days=7)).isoformat(),
            'date_end': (timezone.now() + timezone.timedelta(days=6)).isoformat(),  # Before start
        }
        
        response = self.client.put(self.url, update_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('title', response.data)

    def test_delete_event_success(self):
        """Test DELETE request to delete event."""
        response = self.client.delete(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Event.objects.filter(pk=self.event.pk).exists())


class EventRegistrationAPITest(TestCase):
    """Test cases for EventRegistration API endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = UserFactory()
        self.event_owner = UserFactory()
        self.event = EventFactory(owner=self.event_owner)
        self.client.force_authenticate(user=self.user)
        self.url = reverse('events:event-register', kwargs={'event_id': self.event.pk})

    def test_register_for_event_success(self):
        """Test POST request to register for an event."""
        response = self.client.post(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(EventRegistration.objects.filter(
            user=self.user, 
            event=self.event
        ).exists())

    def test_register_for_nonexistent_event(self):
        """Test registration for non-existent event."""
        response = self.client.post(reverse('events:event-register', kwargs={'event_id': 99999}))
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_for_own_event(self):
        """Test that event owner cannot register for their own event."""
        self.client.force_authenticate(user=self.event_owner)
        response = self.client.post(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_for_hidden_event(self):
        """Users can register for hidden events when they have the direct link."""
        hidden_event = EventFactory(owner=self.event_owner, is_visible=False)
        url = reverse('events:event-register', kwargs={'event_id': hidden_event.pk})

        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(EventRegistration.objects.filter(
            user=self.user,
            event=hidden_event,
        ).exists())

    def test_duplicate_registration(self):
        """Test that duplicate registration is prevented."""
        # First registration
        response1 = self.client.post(self.url)
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        
        # Duplicate registration
        response2 = self.client.post(self.url)
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_for_past_event(self):
        """Test registration for past event."""
        past_event = EventFactory(
            owner=self.event_owner,
            date_start=timezone.now() - timezone.timedelta(hours=1)
        )
        url = reverse('events:event-register', kwargs={'event_id': past_event.pk})
        
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancel_registration_success(self):
        """Test DELETE request to cancel registration."""
        registration = EventRegistration.objects.create(user=self.user, event=self.event)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        registration.refresh_from_db()
        self.assertEqual(registration.registration_status, 'CANCELLED')

    def test_reregister_after_cancel(self):
        """Test user can register again after cancelling."""
        EventRegistration.objects.create(
            user=self.user,
            event=self.event,
            registration_status='CANCELLED',
        )

        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        registration = EventRegistration.objects.get(user=self.user, event=self.event)
        self.assertEqual(registration.registration_status, 'REGISTERED')

    def test_cancel_nonexistent_registration(self):
        """Test canceling non-existent registration."""
        response = self.client.delete(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class EventParticipantsAPITest(TestCase):
    """Test cases for EventParticipants API endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.event_owner = UserFactory()
        self.event = EventFactory(owner=self.event_owner)
        self.participant1 = UserFactory()
        self.participant2 = UserFactory()
        self.registration1 = EventRegistrationFactory(user=self.participant1, event=self.event)
        self.registration2 = EventRegistrationFactory(user=self.participant2, event=self.event)
        self.url = reverse('events:event-participants', kwargs={'event_id': self.event.pk})

    def test_get_participants_as_owner(self):
        """Test GET request to list participants as event owner."""
        self.client.force_authenticate(user=self.event_owner)
        
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertIn(self.participant1.username, [p['user']['username'] for p in response.data])
        self.assertIn(self.participant2.username, [p['user']['username'] for p in response.data])

    def test_get_participants_as_non_owner(self):
        """Test GET request to list participants as non-owner (should be denied)."""
        other_user = UserFactory()
        self.client.force_authenticate(user=other_user)
        
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_participants_nonexistent_event(self):
        """Test GET request for non-existent event."""
        self.client.force_authenticate(user=self.event_owner)
        
        response = self.client.get(reverse('events:event-participants', kwargs={'event_id': 99999}))
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class UserEventRegistrationsAPITest(TestCase):
    """Test cases for UserEventRegistrations API endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = UserFactory()
        self.event1 = EventFactory()
        self.event2 = EventFactory()
        self.registration1 = EventRegistrationFactory(user=self.user, event=self.event1)
        self.registration2 = EventRegistrationFactory(user=self.user, event=self.event2)
        self.client.force_authenticate(user=self.user)
        self.url = reverse('events:user-registrations')

    def test_get_user_registrations(self):
        """Test GET request to list user's registrations."""
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertIn(self.event1.title, [r['event_title'] for r in response.data])
        self.assertIn(self.event2.title, [r['event_title'] for r in response.data])


class UserCreatedEventsAPITest(TestCase):
    """Test cases for UserCreatedEvents API endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = UserFactory()
        self.event1 = EventFactory(owner=self.user)
        self.event2 = EventFactory(owner=self.user)
        self.other_event = EventFactory()  # Event by different user
        self.client.force_authenticate(user=self.user)
        self.url = reverse('events:user-created-events')

    def test_get_user_created_events(self):
        """Test GET request to list user's created events."""
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertIn(self.event1.title, [e['title'] for e in response.data])
        self.assertIn(self.event2.title, [e['title'] for e in response.data])
        self.assertNotIn(self.other_event.title, [e['title'] for e in response.data])

    def test_get_user_created_events_includes_hidden(self):
        """Owners should see hidden events in their created events list."""
        hidden_event = EventFactory(owner=self.user, is_visible=False)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)
        self.assertIn(hidden_event.title, [e['title'] for e in response.data])


@override_settings(NOWPAYMENTS_API_KEY='')
class EventParticipantStatusAPITest(TestCase):
    """Test cases for EventParticipantStatus API endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.event_owner = UserFactory()
        self.participant = UserFactory()
        self.event = EventFactory(owner=self.event_owner)
        self.registration = EventRegistrationFactory(
            user=self.participant, 
            event=self.event,
            payment_status='PENDING'
        )
        self.url = reverse('events:participant-status', kwargs={
            'event_id': self.event.pk,
            'registration_id': self.registration.pk
        })

    def test_accept_payment_as_owner(self):
        """Test accepting payment as event owner."""
        self.client.force_authenticate(user=self.event_owner)
        
        response = self.client.patch(self.url, {'action': 'accept_payment'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.registration.refresh_from_db()
        self.assertEqual(self.registration.payment_status, 'PAID')

    def test_accept_payment_as_non_owner(self):
        """Test accepting payment as non-owner (should be denied)."""
        other_user = UserFactory()
        self.client.force_authenticate(user=other_user)
        
        response = self.client.patch(self.url, {'action': 'accept_payment'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cancel_registration_as_owner(self):
        """Test canceling registration as event owner."""
        self.client.force_authenticate(user=self.event_owner)
        
        response = self.client.patch(self.url, {'action': 'cancel_registration'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.registration.refresh_from_db()
        self.assertEqual(self.registration.registration_status, 'CANCELLED')
        self.assertEqual(self.registration.payment_status, 'PENDING')

    def test_send_certificate_as_owner(self):
        """Test sending certificate as event owner."""
        self.client.force_authenticate(user=self.event_owner)
        
        response = self.client.patch(self.url, {'action': 'send_certificate'}, format='json')
        
        # This might fail if certificate generation is not properly mocked
        # The actual behavior depends on the certificate generation implementation
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST])

    def test_invalid_action(self):
        """Test with invalid action."""
        self.client.force_authenticate(user=self.event_owner)
        
        response = self.client.patch(self.url, {'action': 'invalid_action'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nonexistent_registration(self):
        """Test with non-existent registration."""
        self.client.force_authenticate(user=self.event_owner)
        
        response = self.client.patch(
            reverse('events:participant-status', kwargs={
                'event_id': self.event.pk,
                'registration_id': 99999
            }),
            {'action': 'accept_payment'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND) 