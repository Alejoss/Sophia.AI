import factory
from django.utils import timezone
from factory.django import DjangoModelFactory
from events.models import Event, EventRegistration
from .users import UserFactory


class EventFactory(DjangoModelFactory):
    """Factory for creating test events."""
    class Meta:
        model = Event

    title = factory.Sequence(lambda n: f'Test Event {n}')
    description = factory.Faker('text', max_nb_chars=500)
    event_type = factory.Iterator(['LIVE_COURSE', 'LIVE_CERTIFICATION', 'LIVE_MASTER_CLASS'])
    platform = factory.Iterator(['google_meet', 'zoom', 'microsoft_teams'])
    reference_price = factory.Faker('pydecimal', left_digits=3, right_digits=2, positive=True)
    owner = factory.SubFactory(UserFactory)
    date_start = factory.LazyFunction(lambda: timezone.now() + timezone.timedelta(days=7))
    date_end = factory.LazyFunction(lambda: timezone.now() + timezone.timedelta(days=7, hours=2))
    schedule_description = factory.Faker('text', max_nb_chars=200)


class EventRegistrationFactory(DjangoModelFactory):
    """Factory for creating test event registrations."""
    class Meta:
        model = EventRegistration

    user = factory.SubFactory(UserFactory)
    event = factory.SubFactory(EventFactory)
    registration_status = 'REGISTERED'
    payment_status = 'PENDING'
    notes = factory.Faker('text', max_nb_chars=100) 