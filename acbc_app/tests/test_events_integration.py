from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from events.models import Event, EventRegistration
from tests.factories.events import EventFactory, EventRegistrationFactory
from tests.factories.users import UserFactory


class EventLifecycleIntegrationTest(TestCase):
    """Integration tests for complete event lifecycle."""

    def setUp(self):
        self.client = APIClient()
        self.event_creator = UserFactory()
        self.participant1 = UserFactory()
        self.participant2 = UserFactory()
        self.client.force_authenticate(user=self.event_creator)

    def test_complete_event_lifecycle(self):
        """Test complete event lifecycle: create, register, manage, complete."""
        # 1. Create event
        event_data = {
            'title': 'Complete Lifecycle Event',
            'description': 'Testing the complete event lifecycle',
            'event_type': 'LIVE_COURSE',
            'platform': 'zoom',
            'reference_price': 150.00,
            'date_start': (timezone.now() + timezone.timedelta(days=14)).isoformat(),
            'date_end': (timezone.now() + timezone.timedelta(days=14, hours=3)).isoformat(),
            'schedule_description': 'Every Saturday for 4 weeks'
        }
        
        create_response = self.client.post('/api/events/', event_data, format='json')
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        event_id = create_response.data['id']
        
        # 2. Participants register
        self.client.force_authenticate(user=self.participant1)
        register_response1 = self.client.post(f'/api/events/{event_id}/register/')
        self.assertEqual(register_response1.status_code, status.HTTP_201_CREATED)
        
        self.client.force_authenticate(user=self.participant2)
        register_response2 = self.client.post(f'/api/events/{event_id}/register/')
        self.assertEqual(register_response2.status_code, status.HTTP_201_CREATED)
        
        # 3. Event creator views participants
        self.client.force_authenticate(user=self.event_creator)
        participants_response = self.client.get(f'/api/events/{event_id}/participants/')
        self.assertEqual(participants_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(participants_response.data), 2)
        
        # 4. Event creator manages participant status
        registration_id = participants_response.data[0]['id']
        status_response = self.client.patch(
            f'/api/events/{event_id}/participants/{registration_id}/status/',
            {'action': 'accept_payment'},
            format='json'
        )
        self.assertEqual(status_response.status_code, status.HTTP_200_OK)
        
        # 5. Verify participant can see their registrations
        self.client.force_authenticate(user=self.participant1)
        my_registrations_response = self.client.get('/api/events/my-registrations/')
        self.assertEqual(my_registrations_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(my_registrations_response.data), 1)
        
        # 6. Verify event creator can see their created events
        self.client.force_authenticate(user=self.event_creator)
        my_events_response = self.client.get('/api/events/my-events/')
        self.assertEqual(my_events_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(my_events_response.data), 1)

    def test_event_with_image_upload(self):
        """Test event creation with image upload."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        
        # Create a mock image file with proper JPEG header
        # Minimal valid JPEG file content
        image_content = (
            b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00'
            b'\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08'
            b'\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e'
            b'\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x01\x01\x11\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00\x3f\x00\xaa\xff\xd9'
        )
        image_file = SimpleUploadedFile(
            'test_image.jpg',
            image_content,
            content_type='image/jpeg'
        )
        
        # Test without image first
        event_data = {
            'title': 'Event with Image',
            'description': 'Testing image upload',
            'event_type': 'LIVE_MASTER_CLASS',
            'platform': 'google_meet',
            'reference_price': '99.99',  # String format for multipart
            'date_start': (timezone.now() + timezone.timedelta(days=7)).isoformat(),
            'date_end': (timezone.now() + timezone.timedelta(days=7, hours=2)).isoformat(),
        }
        
        response = self.client.post('/api/events/', event_data, format='json')
        if response.status_code != status.HTTP_201_CREATED:
            print(f"Event creation failed with status {response.status_code}")
            print(f"Response data: {response.data}")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Now test with image
        event_data_with_image = {
            'title': 'Event with Image',
            'description': 'Testing image upload',
            'event_type': 'LIVE_MASTER_CLASS',
            'platform': 'google_meet',
            'reference_price': '99.99',  # String format for multipart
            'date_start': (timezone.now() + timezone.timedelta(days=7)).isoformat(),
            'date_end': (timezone.now() + timezone.timedelta(days=7, hours=2)).isoformat(),
            'image': image_file
        }
        
        response = self.client.post('/api/events/', event_data_with_image, format='multipart')
        if response.status_code != status.HTTP_201_CREATED:
            print(f"Event creation with image failed with status {response.status_code}")
            print(f"Response data: {response.data}")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('image', response.data)

    def test_event_registration_cancellation_flow(self):
        """Test event registration and cancellation flow."""
        # Create event
        event = EventFactory(owner=self.event_creator)
        
        # Register participant
        self.client.force_authenticate(user=self.participant1)
        register_response = self.client.post(f'/api/events/{event.id}/register/')
        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)
        
        # Verify registration exists
        self.assertTrue(EventRegistration.objects.filter(
            user=self.participant1,
            event=event
        ).exists())
        
        # Cancel registration
        cancel_response = self.client.delete(f'/api/events/{event.id}/register/')
        self.assertEqual(cancel_response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Verify registration is removed
        self.assertFalse(EventRegistration.objects.filter(
            user=self.participant1,
            event=event
        ).exists())

    def test_event_validation_edge_cases(self):
        """Test various validation edge cases."""
        # Test event with 'other' platform but no other_platform
        event_data = {
            'title': 'Invalid Event',
            'description': 'Testing validation',
            'event_type': 'LIVE_COURSE',
            'platform': 'other',
            'other_platform': ''  # Empty other_platform
        }
        
        response = self.client.post('/api/events/', event_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('other_platform', response.data)
        
        # Test event with invalid date range
        event_data = {
            'title': 'Invalid Date Event',
            'description': 'Testing date validation',
            'event_type': 'LIVE_COURSE',
            'platform': 'zoom',
            'date_start': (timezone.now() + timezone.timedelta(days=7)).isoformat(),
            'date_end': (timezone.now() + timezone.timedelta(days=6)).isoformat(),  # Before start
        }
        
        response = self.client.post('/api/events/', event_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('date_end', response.data)

    def test_participant_management_workflow(self):
        """Test complete participant management workflow."""
        # Create event with multiple participants
        event = EventFactory(owner=self.event_creator)
        registration1 = EventRegistrationFactory(user=self.participant1, event=event)
        registration2 = EventRegistrationFactory(user=self.participant2, event=event)
        
        # Event creator manages participants
        self.client.force_authenticate(user=self.event_creator)
        
        # Accept payment for first participant
        status_response1 = self.client.patch(
            f'/api/events/{event.id}/participants/{registration1.id}/status/',
            {'action': 'accept_payment'},
            format='json'
        )
        self.assertEqual(status_response1.status_code, status.HTTP_200_OK)
        
        # Cancel registration for second participant
        status_response2 = self.client.patch(
            f'/api/events/{event.id}/participants/{registration2.id}/status/',
            {'action': 'cancel_registration'},
            format='json'
        )
        self.assertEqual(status_response2.status_code, status.HTTP_200_OK)
        
        # Verify status changes
        registration1.refresh_from_db()
        registration2.refresh_from_db()
        self.assertEqual(registration1.payment_status, 'PAID')
        self.assertEqual(registration2.registration_status, 'CANCELLED')
        self.assertEqual(registration2.payment_status, 'PENDING')

    def test_event_filtering_and_search(self):
        """Test event filtering and search functionality."""
        # Create events with different owners
        owner1 = UserFactory()
        owner2 = UserFactory()
        
        event1 = EventFactory(owner=owner1, title='Event by Owner 1')
        event2 = EventFactory(owner=owner2, title='Event by Owner 2')
        event3 = EventFactory(owner=owner1, title='Another Event by Owner 1')
        
        # Test filtering by owner
        self.client.force_authenticate(user=UserFactory())
        response = self.client.get(f'/api/events/?owner={owner1.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertIn(event1.title, [e['title'] for e in response.data])
        self.assertIn(event3.title, [e['title'] for e in response.data])
        self.assertNotIn(event2.title, [e['title'] for e in response.data])

    def test_concurrent_registration_handling(self):
        """Test handling of concurrent registration attempts."""
        event = EventFactory(owner=self.event_creator)
        
        # Simulate concurrent registration attempts
        self.client.force_authenticate(user=self.participant1)
        
        # First registration should succeed
        response1 = self.client.post(f'/api/events/{event.id}/register/')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        
        # Second registration should fail (duplicate)
        response2 = self.client.post(f'/api/events/{event.id}/register/')
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Verify only one registration exists
        registrations = EventRegistration.objects.filter(user=self.participant1, event=event)
        self.assertEqual(registrations.count(), 1)

    def test_event_permissions_and_access_control(self):
        """Test event permissions and access control."""
        event = EventFactory(owner=self.event_creator)
        registration = EventRegistrationFactory(user=self.participant1, event=event)
        
        # Test that non-owner cannot view participants
        self.client.force_authenticate(user=self.participant1)
        response = self.client.get(f'/api/events/{event.id}/participants/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Test that non-owner cannot manage participant status
        response = self.client.patch(
            f'/api/events/{event.id}/participants/{registration.id}/status/',
            {'action': 'accept_payment'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Test that owner can perform these actions
        self.client.force_authenticate(user=self.event_creator)
        response = self.client.get(f'/api/events/{event.id}/participants/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        response = self.client.patch(
            f'/api/events/{event.id}/participants/{registration.id}/status/',
            {'action': 'accept_payment'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK) 