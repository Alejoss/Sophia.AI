from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory
from rest_framework.exceptions import ValidationError
from events.serializers import EventSerializer, EventRegistrationSerializer, EventRegistrationListSerializer
from events.models import Event, EventRegistration
from tests.factories.events import EventFactory, EventRegistrationFactory
from tests.factories.users import UserFactory


class EventSerializerTest(TestCase):
    """Test cases for EventSerializer."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = UserFactory()
        self.request = self.factory.get('/')
        self.request.user = self.user
        
        self.event_data = {
            'title': 'Test Event',
            'description': 'Test Description',
            'event_type': 'LIVE_COURSE',
            'platform': 'google_meet',
            'reference_price': 99.99,
            'date_start': timezone.now() + timezone.timedelta(days=7),
            'date_end': timezone.now() + timezone.timedelta(days=7, hours=2),
            'schedule_description': 'Every Tuesday for 5 weeks'
        }

    def test_event_serializer_creation(self):
        """Test event creation through serializer."""
        serializer = EventSerializer(data=self.event_data, context={'request': self.request})
        self.assertTrue(serializer.is_valid())
        event = serializer.save()
        
        self.assertEqual(event.title, 'Test Event')
        self.assertEqual(event.owner, self.user)
        self.assertEqual(event.event_type, 'LIVE_COURSE')
        self.assertEqual(event.reference_price, 99.99)

    def test_event_serializer_validation_other_platform_required(self):
        """Test validation when platform is 'other' but other_platform is missing."""
        self.event_data['platform'] = 'other'
        self.event_data['other_platform'] = ''
        
        serializer = EventSerializer(data=self.event_data, context={'request': self.request})
        self.assertFalse(serializer.is_valid())
        self.assertIn('other_platform', serializer.errors)

    def test_event_serializer_validation_other_platform_success(self):
        """Test validation passes when platform is 'other' and other_platform is provided."""
        self.event_data['platform'] = 'other'
        self.event_data['other_platform'] = 'Custom Platform'
        
        serializer = EventSerializer(data=self.event_data, context={'request': self.request})
        self.assertTrue(serializer.is_valid())

    def test_event_serializer_validation_date_end_before_start(self):
        """Test validation when end date is before start date."""
        self.event_data['date_start'] = timezone.now() + timezone.timedelta(days=7)
        self.event_data['date_end'] = timezone.now() + timezone.timedelta(days=6)
        
        serializer = EventSerializer(data=self.event_data, context={'request': self.request})
        self.assertFalse(serializer.is_valid())
        self.assertIn('date_end', serializer.errors)

    def test_event_serializer_validation_date_end_equals_start(self):
        """Test validation when end date equals start date."""
        start_time = timezone.now() + timezone.timedelta(days=7)
        self.event_data['date_start'] = start_time
        self.event_data['date_end'] = start_time
        
        serializer = EventSerializer(data=self.event_data, context={'request': self.request})
        self.assertFalse(serializer.is_valid())
        self.assertIn('date_end', serializer.errors)

    def test_event_serializer_update(self):
        """Test event update through serializer."""
        event = EventFactory(owner=self.user)
        update_data = {'title': 'Updated Title', 'description': 'Updated Description'}
        
        serializer = EventSerializer(event, data=update_data, partial=True, context={'request': self.request})
        self.assertTrue(serializer.is_valid())
        updated_event = serializer.save()
        
        self.assertEqual(updated_event.title, 'Updated Title')
        self.assertEqual(updated_event.description, 'Updated Description')

    def test_event_serializer_to_representation(self):
        """Test that image URLs are properly formatted in representation."""
        event = EventFactory(owner=self.user)
        # Note: In a real test, you might need to mock the image field
        
        serializer = EventSerializer(event, context={'request': self.request})
        data = serializer.data
        
        self.assertIn('image', data)
        self.assertIn('owner', data)
        self.assertIn('owner_accepted_cryptos', data)

    def test_event_serializer_without_required_fields(self):
        """Test serializer validation without required fields."""
        incomplete_data = {
            'title': '',  # Empty title
            'description': '',  # Empty description
        }
        
        serializer = EventSerializer(data=incomplete_data, context={'request': self.request})
        self.assertFalse(serializer.is_valid())
        # Note: The actual required fields depend on your model validation


class EventRegistrationSerializerTest(TestCase):
    """Test cases for EventRegistrationSerializer."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = UserFactory()
        self.event_owner = UserFactory()
        self.event = EventFactory(owner=self.event_owner)
        self.request = self.factory.get('/')
        self.request.user = self.user

    def test_registration_serializer_creation(self):
        """Test registration creation through serializer."""
        data = {'event': self.event.id}
        
        serializer = EventRegistrationSerializer(data=data, context={'request': self.request})
        self.assertTrue(serializer.is_valid())
        registration = serializer.save()
        
        self.assertEqual(registration.user, self.user)
        self.assertEqual(registration.event, self.event)
        self.assertEqual(registration.registration_status, 'REGISTERED')
        self.assertEqual(registration.payment_status, 'PENDING')

    def test_registration_serializer_duplicate_registration(self):
        """Test that duplicate registration is prevented."""
        # Create first registration
        EventRegistration.objects.create(user=self.user, event=self.event)
        
        # Try to create duplicate
        data = {'event': self.event.id}
        serializer = EventRegistrationSerializer(data=data, context={'request': self.request})
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)

    def test_registration_serializer_self_registration_prevention(self):
        """Test that event owner cannot register for their own event."""
        self.request.user = self.event_owner
        data = {'event': self.event.id}
        
        serializer = EventRegistrationSerializer(data=data, context={'request': self.request})
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)

    def test_registration_serializer_past_event_prevention(self):
        """Test that users cannot register for past events."""
        past_event = EventFactory(
            owner=self.event_owner,
            date_start=timezone.now() - timezone.timedelta(hours=1)
        )
        
        data = {'event': past_event.id}
        serializer = EventRegistrationSerializer(data=data, context={'request': self.request})
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)

    def test_registration_serializer_unauthenticated_user(self):
        """Test that unauthenticated users cannot register."""
        self.request.user = None
        data = {'event': self.event.id}
        
        serializer = EventRegistrationSerializer(data=data, context={'request': self.request})
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)

    def test_registration_serializer_invalid_event(self):
        """Test registration with invalid event ID."""
        data = {'event': 99999}  # Non-existent event
        
        serializer = EventRegistrationSerializer(data=data, context={'request': self.request})
        self.assertFalse(serializer.is_valid())
        self.assertIn('event', serializer.errors)


class EventRegistrationListSerializerTest(TestCase):
    """Test cases for EventRegistrationListSerializer."""

    def setUp(self):
        self.user = UserFactory()
        self.event_owner = UserFactory()
        self.event = EventFactory(owner=self.event_owner)
        self.registration = EventRegistrationFactory(user=self.user, event=self.event)

    def test_registration_list_serializer_data(self):
        """Test that serializer provides correct data structure."""
        serializer = EventRegistrationListSerializer(self.registration)
        data = serializer.data
        
        self.assertIn('id', data)
        self.assertIn('user', data)
        self.assertIn('user_email', data)
        self.assertIn('event', data)
        self.assertIn('event_title', data)
        self.assertIn('event_date', data)
        self.assertIn('registered_at', data)
        self.assertIn('registration_status', data)
        self.assertIn('payment_status', data)
        self.assertIn('has_certificate', data)

    def test_registration_list_serializer_user_data(self):
        """Test that user data is properly serialized."""
        serializer = EventRegistrationListSerializer(self.registration)
        data = serializer.data
        
        self.assertEqual(data['user']['username'], self.user.username)
        self.assertEqual(data['user_email'], self.user.email)

    def test_registration_list_serializer_event_data(self):
        """Test that event data is properly serialized."""
        serializer = EventRegistrationListSerializer(self.registration)
        data = serializer.data
        
        self.assertEqual(data['event'], self.event.id)
        self.assertEqual(data['event_title'], self.event.title)
        self.assertEqual(data['event_date'], self.event.date_start.isoformat().replace('+00:00', 'Z'))

    def test_registration_list_serializer_has_certificate_false(self):
        """Test has_certificate field when no certificate exists."""
        serializer = EventRegistrationListSerializer(self.registration)
        data = serializer.data
        
        self.assertFalse(data['has_certificate'])

    def test_registration_list_serializer_has_certificate_true(self):
        """Test has_certificate field when certificate exists."""
        # Create a certificate for this registration
        from certificates.models import Certificate
        Certificate.objects.create(
            user=self.user,
            event=self.event,
            blockchain_hash='test_hash'
        )
        
        serializer = EventRegistrationListSerializer(self.registration)
        data = serializer.data
        
        self.assertTrue(data['has_certificate']) 