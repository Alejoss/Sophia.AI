# Backend Testing Guide

This guide covers testing patterns and examples for the Django backend.

## Test Framework

The project uses:
- **pytest** - Primary test framework
- **Django TestCase** - For Django-specific tests
- **factory-boy** - For test data generation
- **coverage** - For coverage reporting

## Running Tests

### Run All Tests

```bash
docker-compose exec backend python manage.py test
```

### Run with Pytest

```bash
docker-compose exec backend pytest
```

### Run Specific App Tests

```bash
docker-compose exec backend python manage.py test profiles
docker-compose exec backend pytest acbc_app/profiles/tests.py
```

### Run with Coverage

```bash
docker-compose exec backend pytest --cov=. --cov-report=html
```

Coverage report will be in `htmlcov/index.html`

## Test Patterns

### Model Tests

```python
from django.test import TestCase
from profiles.models import Profile
from django.contrib.auth.models import User

class ProfileModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    def test_profile_creation(self):
        profile = Profile.objects.create(
            user=self.user,
            interests='Blockchain, AI'
        )
        self.assertEqual(profile.user, self.user)
        self.assertEqual(profile.interests, 'Blockchain, AI')
```

### API View Tests

```python
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth.models import User

class ContentAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_list_content(self):
        response = self.client.get('/api/content/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_create_content(self):
        data = {
            'original_title': 'Test Content',
            'media_type': 'TEXT'
        }
        response = self.client.post('/api/content/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
```

### Serializer Tests

```python
from rest_framework.test import APITestCase
from content.serializers import ContentSerializer

class ContentSerializerTest(APITestCase):
    def test_valid_data(self):
        data = {
            'original_title': 'Test',
            'media_type': 'TEXT'
        }
        serializer = ContentSerializer(data=data)
        self.assertTrue(serializer.is_valid())
    
    def test_invalid_media_type(self):
        data = {
            'original_title': 'Test',
            'media_type': 'INVALID'
        }
        serializer = ContentSerializer(data=data)
        self.assertFalse(serializer.is_valid())
```

## Using Factory Boy

```python
import factory
from django.contrib.auth.models import User
from profiles.models import Profile

class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
    
    username = factory.Sequence(lambda n: f'user{n}')
    email = factory.LazyAttribute(lambda obj: f'{obj.username}@example.com')

class ProfileFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Profile
    
    user = factory.SubFactory(UserFactory)
    interests = 'Blockchain'
```

## Test Markers

Pytest markers defined in `pytest.ini`:

- `@pytest.mark.integration` - Integration tests
- `@pytest.mark.unit` - Unit tests
- `@pytest.mark.slow` - Slow tests
- `@pytest.mark.api` - API tests
- `@pytest.mark.model` - Model tests

Usage:
```python
@pytest.mark.integration
def test_api_integration():
    pass
```

## Best Practices

1. **Use setUp/tearDown** for test data
2. **Test edge cases** and error conditions
3. **Keep tests independent** - don't rely on test order
4. **Use descriptive test names** - `test_user_cannot_delete_other_users_content`
5. **Mock external services** - don't make real API calls
6. **Test both success and failure** cases

## Related Documentation

- [Testing Strategy](strategy.md)
- [Development Guides](../development/README.md)

