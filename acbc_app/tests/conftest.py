import pytest
from django.conf import settings
from django.core.management import call_command
from django.db import connection


@pytest.fixture(scope='session')
def django_db_setup(django_db_setup, django_db_blocker):
    """Set up the test database."""
    with django_db_blocker.unblock():
        # Run migrations
        call_command('migrate', verbosity=0)
        
        # Create test data if needed
        # call_command('loaddata', 'test_data.json', verbosity=0)


@pytest.fixture(autouse=True)
def enable_db_access_for_all_tests(db):
    """Enable database access for all tests."""
    pass


@pytest.fixture
def api_client():
    """Provide an API client for testing."""
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def authenticated_client(api_client):
    """Provide an authenticated API client."""
    from tests.factories.users import UserFactory
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def event_creator_client(api_client):
    """Provide an API client authenticated as an event creator."""
    from tests.factories.users import UserFactory
    from tests.factories.events import EventFactory
    user = UserFactory()
    event = EventFactory(owner=user)
    api_client.force_authenticate(user=user)
    return api_client, user, event


@pytest.fixture
def participant_client(api_client):
    """Provide an API client authenticated as a participant."""
    from tests.factories.users import UserFactory
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client, user 