from django.test import TestCase
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.contrib.auth.models import User
from events.models import Event, EventRegistration
from tests.factories.events import EventFactory, EventRegistrationFactory
from tests.factories.users import UserFactory


class EventModelTest(TestCase):
    """Test cases for Event model."""

    def setUp(self):
        self.user = UserFactory()
        self.event_data = {
            'title': 'Test Event',
            'description': 'Test Description',
            'event_type': 'LIVE_COURSE',
            'platform': 'google_meet',
            'owner': self.user,
            'date_start': timezone.now() + timezone.timedelta(days=7),
            'date_end': timezone.now() + timezone.timedelta(days=7, hours=2),
        }

    def test_event_creation(self):
        """Test basic event creation."""
        event = Event.objects.create(**self.event_data)
        self.assertEqual(event.title, 'Test Event')
        self.assertEqual(event.owner, self.user)
        self.assertEqual(event.event_type, 'LIVE_COURSE')
        self.assertFalse(event.deleted)

    def test_event_str_representation(self):
        """Test string representation of event."""
        event = EventFactory(owner=self.user)
        expected = f"{event.title} - {self.user.username}"
        self.assertEqual(str(event), expected)

    def test_event_ordering(self):
        """Test that events are ordered by date_created descending."""
        event1 = EventFactory()
        event2 = EventFactory()
        events = Event.objects.all()
        self.assertEqual(events[0], event2)  # Most recent first
        self.assertEqual(events[1], event1)

    def test_other_platform_validation(self):
        """Test validation when platform is 'other' but other_platform is empty."""
        self.event_data['platform'] = 'other'
        self.event_data['other_platform'] = ''
        
        with self.assertRaises(ValidationError):
            event = Event(**self.event_data)
            event.full_clean()

    def test_other_platform_validation_success(self):
        """Test validation passes when platform is 'other' and other_platform is provided."""
        self.event_data['platform'] = 'other'
        self.event_data['other_platform'] = 'Custom Platform'
        
        event = Event(**self.event_data)
        event.full_clean()  # Should not raise ValidationError

    def test_date_validation_end_before_start(self):
        """Test validation when end date is before start date."""
        self.event_data['date_start'] = timezone.now() + timezone.timedelta(days=7)
        self.event_data['date_end'] = timezone.now() + timezone.timedelta(days=6)
        
        with self.assertRaises(ValidationError):
            event = Event(**self.event_data)
            event.full_clean()

    def test_date_validation_end_equals_start(self):
        """Test validation when end date equals start date."""
        start_time = timezone.now() + timezone.timedelta(days=7)
        self.event_data['date_start'] = start_time
        self.event_data['date_end'] = start_time
        
        with self.assertRaises(ValidationError):
            event = Event(**self.event_data)
            event.full_clean()

    def test_date_validation_success(self):
        """Test validation passes when end date is after start date."""
        self.event_data['date_start'] = timezone.now() + timezone.timedelta(days=7)
        self.event_data['date_end'] = timezone.now() + timezone.timedelta(days=7, hours=2)
        
        event = Event(**self.event_data)
        event.full_clean()  # Should not raise ValidationError

    def test_event_without_dates(self):
        """Test event creation without start/end dates."""
        self.event_data.pop('date_start', None)
        self.event_data.pop('date_end', None)
        
        event = Event.objects.create(**self.event_data)
        self.assertIsNone(event.date_start)
        self.assertIsNone(event.date_end)


class EventRegistrationModelTest(TestCase):
    """Test cases for EventRegistration model."""

    def setUp(self):
        self.user = UserFactory()
        self.event_owner = UserFactory()
        self.event = EventFactory(owner=self.event_owner)

    def test_registration_creation(self):
        """Test basic registration creation."""
        registration = EventRegistration.objects.create(
            user=self.user,
            event=self.event
        )
        self.assertEqual(registration.user, self.user)
        self.assertEqual(registration.event, self.event)
        self.assertEqual(registration.registration_status, 'REGISTERED')
        self.assertEqual(registration.payment_status, 'PENDING')

    def test_registration_str_representation(self):
        """Test string representation of registration."""
        registration = EventRegistrationFactory(user=self.user, event=self.event)
        expected = f"{self.user.username} - {self.event.title} (REGISTERED)"
        self.assertEqual(str(registration), expected)

    def test_registration_ordering(self):
        """Test that registrations are ordered by registered_at descending."""
        reg1 = EventRegistrationFactory(event=self.event)
        reg2 = EventRegistrationFactory(event=self.event)
        registrations = EventRegistration.objects.all()
        self.assertEqual(registrations[0], reg2)  # Most recent first
        self.assertEqual(registrations[1], reg1)

    def test_unique_together_constraint(self):
        """Test that user can only register once per event."""
        EventRegistration.objects.create(user=self.user, event=self.event)
        
        with self.assertRaises(Exception):  # IntegrityError or similar
            EventRegistration.objects.create(user=self.user, event=self.event)

    def test_self_registration_prevention(self):
        """Test that event owner cannot register for their own event."""
        with self.assertRaises(ValidationError):
            registration = EventRegistration(
                user=self.event_owner,
                event=self.event
            )
            registration.full_clean()

    def test_past_event_registration_prevention(self):
        """Test that users cannot register for events that have already started."""
        past_event = EventFactory(
            owner=self.event_owner,
            date_start=timezone.now() - timezone.timedelta(hours=1)
        )
        
        with self.assertRaises(ValidationError):
            registration = EventRegistration(
                user=self.user,
                event=past_event
            )
            registration.full_clean()

    def test_registration_status_choices(self):
        """Test registration status choices."""
        registration = EventRegistrationFactory()
        
        # Test valid choices
        registration.registration_status = 'REGISTERED'
        registration.full_clean()
        
        registration.registration_status = 'CANCELLED'
        registration.full_clean()

    def test_payment_status_choices(self):
        """Test payment status choices."""
        registration = EventRegistrationFactory()
        
        # Test valid choices
        registration.payment_status = 'PENDING'
        registration.full_clean()
        
        registration.payment_status = 'PAID'
        registration.full_clean()
        
        registration.payment_status = 'REFUNDED'
        registration.full_clean() 