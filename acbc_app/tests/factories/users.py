import factory
from django.contrib.auth.models import User
from factory.django import DjangoModelFactory

class UserFactory(DjangoModelFactory):
    """Factory for creating test users."""
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f'user{n}')
    email = factory.Sequence(lambda n: f'user{n}@example.com')
    password = factory.PostGenerationMethodCall('set_password', 'testpass123')
    is_active = True
    is_staff = False
    is_superuser = False

class AdminUserFactory(UserFactory):
    """Factory for creating admin users."""
    is_staff = True
    is_superuser = True 