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
        self.assertFalse(event.is_visible)

    def test_event_serializer_create_public(self):
        """Test event can be created as public when requested."""
        self.event_data['is_visible'] = True
        serializer = EventSerializer(data=self.event_data, context={'request': self.request})
        self.assertTrue(serializer.is_valid())
        event = serializer.save()

        self.assertTrue(event.is_visible)

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

    def test_event_serializer_accepts_date_without_time(self):
        """A calendar date is stored without treating noon as a chosen clock time."""
        self.event_data['date_start'] = '2026-11-16'
        self.event_data['date_end'] = '2026-11-16'

        serializer = EventSerializer(data=self.event_data, context={'request': self.request})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        event = serializer.save()

        self.assertFalse(event.date_start_has_time)
        self.assertFalse(event.date_end_has_time)
        self.assertEqual(event.date_start.date().isoformat(), '2026-11-16')
        self.assertEqual(event.date_end.date().isoformat(), '2026-11-16')
        self.assertEqual(event.date_start.hour, 12)
        self.assertEqual(serializer.data['date_start_has_time'], False)

    def test_event_serializer_blank_date_clears_the_field(self):
        self.event_data['date_start'] = ''
        self.event_data['date_end'] = ''

        serializer = EventSerializer(data=self.event_data, context={'request': self.request})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        event = serializer.save()

        self.assertIsNone(event.date_start)
        self.assertIsNone(event.date_end)
        self.assertFalse(event.date_start_has_time)
        self.assertFalse(event.date_end_has_time)

    def test_event_serializer_keeps_an_explicit_time(self):
        self.event_data['date_start'] = '2026-11-16T15:30:00Z'
        self.event_data['date_end'] = '2026-11-16T17:00:00Z'

        serializer = EventSerializer(data=self.event_data, context={'request': self.request})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        event = serializer.save()

        self.assertTrue(event.date_start_has_time)
        self.assertTrue(event.date_end_has_time)
        self.assertEqual(event.date_start.hour, 15)
        self.assertEqual(event.date_start.minute, 30)

    def test_event_serializer_validation_date_end_equals_start(self):
        """Test validation when end date equals start date."""
        start_time = timezone.now() + timezone.timedelta(days=7)
        self.event_data['date_start'] = start_time
        self.event_data['date_end'] = start_time
        
        serializer = EventSerializer(data=self.event_data, context={'request': self.request})
        self.assertFalse(serializer.is_valid())
        self.assertIn('date_end', serializer.errors)

    def test_event_serializer_links_a_published_course_page(self):
        self.event_data['course_code'] = 'real-historia-bitcoin'
        serializer = EventSerializer(data=self.event_data, context={'request': self.request})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        event = serializer.save()

        self.assertEqual(event.course_links.get().course.code, 'real-historia-bitcoin')
        self.assertEqual(serializer.data['landing_page']['path'], '/cursos/real-historia-bitcoin')
        self.assertEqual(serializer.data['landing_page']['course_code'], 'real-historia-bitcoin')

    def test_event_serializer_rejects_an_unpublished_course_page(self):
        self.event_data['course_code'] = 'no-such-course'
        serializer = EventSerializer(data=self.event_data, context={'request': self.request})
        self.assertFalse(serializer.is_valid())
        self.assertIn('course_code', serializer.errors)

    def test_event_serializer_can_clear_the_course_page(self):
        from payments.models import Course, CourseEvent
        event = EventFactory(owner=self.user)
        course = Course.objects.get(code='real-historia-bitcoin')
        CourseEvent.objects.create(course=course, event=event)

        serializer = EventSerializer(
            event,
            data={'title': event.title, 'description': event.description, 'course_code': ''},
            partial=True,
            context={'request': self.request},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.assertFalse(event.course_links.filter(course__public_landing=True).exists())
        self.assertIsNone(serializer.data['landing_page'])

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

    def test_registration_serializer_reactivate_after_cancel(self):
        """Test re-registration reactivates a cancelled row."""
        EventRegistration.objects.create(
            user=self.user,
            event=self.event,
            registration_status='CANCELLED',
        )
        data = {'event': self.event.id}
        serializer = EventRegistrationSerializer(data=data, context={'request': self.request})
        self.assertTrue(serializer.is_valid())
        registration = serializer.save()
        self.assertEqual(registration.registration_status, 'REGISTERED')
        self.assertEqual(EventRegistration.objects.filter(user=self.user, event=self.event).count(), 1)

    def test_registration_serializer_duplicate_registration(self):
        """Test that duplicate registration is prevented."""
        EventRegistration.objects.create(user=self.user, event=self.event)

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

    def test_registration_serializer_hidden_event_allowed(self):
        """Hidden events can still accept registrations via direct link."""
        hidden_event = EventFactory(owner=self.event_owner, is_visible=False)
        data = {'event': hidden_event.id}

        serializer = EventRegistrationSerializer(data=data, context={'request': self.request})
        self.assertTrue(serializer.is_valid(), serializer.errors)

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