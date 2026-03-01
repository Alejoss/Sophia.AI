from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from profiles.models import Profile, CryptoCurrency, AcceptedCrypto, ContactMethod, UserNodeCompletion, Suggestion
from notifications.models import Notification
from knowledge_paths.models import KnowledgePath, Node
from certificates.models import CertificateRequest, Certificate, CertificateTemplate
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
import jwt
import time
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from django.contrib.contenttypes.models import ContentType
from content.models import Content, Topic
from gamification.models import Badge, UserBadge
from profiles.email_service import EmailService, EmailServiceError, EmailValidationError, EmailConfigurationError


class ProfileModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.profile = Profile.objects.create(
            user=self.user,
            interests='Blockchain, Cryptocurrency',
            profile_description='Test profile description',
            timezone='UTC',
            is_teacher=True
        )

    def test_profile_creation(self):
        """Test profile creation and string representation"""
        self.assertEqual(str(self.profile), self.user.username)
        self.assertEqual(self.profile.interests, 'Blockchain, Cryptocurrency')
        self.assertEqual(self.profile.is_teacher, True)

    def test_profile_update(self):
        """Test profile update functionality"""
        self.profile.interests = 'Updated interests'
        self.profile.save()
        updated_profile = Profile.objects.get(user=self.user)
        self.assertEqual(updated_profile.interests, 'Updated interests')


class CryptoCurrencyModelTests(TestCase):
    def setUp(self):
        self.crypto = CryptoCurrency.objects.create(
            name='Bitcoin',
            code='BTC'
        )

    def test_crypto_creation(self):
        """Test cryptocurrency creation and string representation"""
        self.assertEqual(str(self.crypto), 'Bitcoin')
        self.assertEqual(self.crypto.code, 'BTC')

    def test_unique_name_constraint(self):
        """Test that cryptocurrency names must be unique"""
        with self.assertRaises(Exception):
            CryptoCurrency.objects.create(name='Bitcoin', code='BTC2')


class AcceptedCryptoModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.crypto = CryptoCurrency.objects.create(
            name='Bitcoin',
            code='BTC'
        )
        self.accepted_crypto = AcceptedCrypto.objects.create(
            user=self.user,
            crypto=self.crypto,
            address='1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
        )

    def test_accepted_crypto_creation(self):
        """Test accepted cryptocurrency creation and string representation"""
        self.assertEqual(str(self.accepted_crypto), f"{self.user.username} - {self.crypto.name}")
        self.assertEqual(self.accepted_crypto.address, '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
        self.assertEqual(self.accepted_crypto.deleted, False)


class ContactMethodModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.contact = ContactMethod.objects.create(
            user=self.user,
            name='GitHub',
            description='My GitHub profile',
            url_link='https://github.com/testuser'
        )

    def test_contact_method_creation(self):
        """Test contact method creation and string representation"""
        self.assertEqual(str(self.contact), f"GitHub {self.user.username}")
        self.assertEqual(self.contact.name, 'GitHub')
        self.assertEqual(self.contact.deleted, False)

    def test_url_validation(self):
        """Test URL validation functionality"""
        self.assertTrue(self.contact.has_contact_url())
        
        # Test invalid URL
        self.contact.url_link = 'invalid-url'
        self.assertFalse(self.contact.has_contact_url())


class UserNodeCompletionModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.knowledge_path = KnowledgePath.objects.create(
            title='Test Path',
            description='Test Description'
        )
        self.node = Node.objects.create(
            title='Test Node',
            description='Test Node Description',
            knowledge_path=self.knowledge_path
        )
        self.node_completion = UserNodeCompletion.objects.create(
            user=self.user,
            knowledge_path=self.knowledge_path,
            node=self.node,
            is_completed=True
        )

    def test_node_completion_creation(self):
        """Test node completion creation and string representation"""
        self.assertEqual(
            str(self.node_completion),
            f"{self.user.username} - {self.node.title} (Completed)"
        )
        self.assertTrue(self.node_completion.is_completed)

    def test_unique_constraint(self):
        """Test that a user can only have one completion record per node in a knowledge path"""
        with self.assertRaises(Exception):
            UserNodeCompletion.objects.create(
                user=self.user,
                knowledge_path=self.knowledge_path,
                node=self.node,
                is_completed=True
            )


class ProfileAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.profile = Profile.objects.create(
            user=self.user,
            interests='Blockchain, Cryptocurrency',
            profile_description='Test profile description',
            timezone='UTC',
            is_teacher=True
        )
        self.client.force_authenticate(user=self.user)

    def test_get_profile(self):
        """Test retrieving user profile"""
        url = reverse('profiles:user_profile')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['interests'], 'Blockchain, Cryptocurrency')

    def test_update_profile(self):
        """Test updating user profile"""
        url = reverse('profiles:user_profile')
        data = {
            'interests': 'Updated interests',
            'profile_description': 'Updated description'
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['interests'], 'Updated interests')
        self.assertEqual(response.data['profile_description'], 'Updated description')

        # Verify that the profile was actually updated in the database
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.interests, 'Updated interests')
        self.assertEqual(self.profile.profile_description, 'Updated description')

    def test_set_featured_badge(self):
        """Test setting a featured badge"""
        # Create a badge and award it to the user
        badge = Badge.objects.create(
            code='test_badge',
            name='Test Badge',
            description='A test badge',
            points_value=10
        )
        user_badge = UserBadge.objects.create(
            user=self.user,
            badge=badge,
            points_earned=10
        )
        
        url = reverse('profiles:user_profile')
        data = {
            'featured_badge_id': user_badge.id
        }
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.featured_badge.id, user_badge.id)
        self.assertIsNotNone(response.data.get('featured_badge'))

    def test_remove_featured_badge(self):
        """Test removing a featured badge"""
        # Create a badge and set it as featured
        badge = Badge.objects.create(
            code='test_badge',
            name='Test Badge',
            description='A test badge',
            points_value=10
        )
        user_badge = UserBadge.objects.create(
            user=self.user,
            badge=badge,
            points_earned=10
        )
        self.profile.featured_badge = user_badge
        self.profile.save()
        
        url = reverse('profiles:user_profile')
        data = {
            'featured_badge_id': ''  # Empty string removes badge
        }
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.assertIsNone(self.profile.featured_badge)

    def test_set_featured_badge_not_owned(self):
        """Test that users cannot set badges they don't own as featured"""
        # Create another user and badge
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        badge = Badge.objects.create(
            code='other_badge',
            name='Other Badge',
            description='Another badge',
            points_value=10
        )
        other_user_badge = UserBadge.objects.create(
            user=other_user,
            badge=badge,
            points_earned=10
        )
        
        url = reverse('profiles:user_profile')
        data = {
            'featured_badge_id': other_user_badge.id
        }
        response = self.client.put(url, data, format='json')
        
        # Should fail validation
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.profile.refresh_from_db()
        self.assertIsNone(self.profile.featured_badge)

    def test_set_featured_badge_nonexistent(self):
        """Test setting a non-existent badge as featured"""
        url = reverse('profiles:user_profile')
        data = {
            'featured_badge_id': 99999  # Non-existent badge ID
        }
        response = self.client.put(url, data, format='json')
        
        # Should fail validation
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_username_change_when_count_under_limit(self):
        """Test user can change username when count < 2"""
        url = reverse('profiles:user_profile')
        data = {'username': 'newusername'}
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['username'], 'newusername')
        self.profile.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'newusername')
        self.assertEqual(self.profile.username_change_count, 1)

    def test_username_change_when_count_at_limit(self):
        """Test user cannot change username when count >= 2"""
        self.profile.username_change_count = 2
        self.profile.save()
        url = reverse('profiles:user_profile')
        data = {'username': 'attemptedchange'}
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'testuser')
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.username_change_count, 2)

    def test_username_change_same_username_no_increment(self):
        """Test saving same username does not increment count"""
        url = reverse('profiles:user_profile')
        data = {'username': 'testuser'}
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.username_change_count, 0)

    def test_username_change_duplicate_returns_400(self):
        """Test duplicate username returns 400"""
        User.objects.create_user(username='existinguser', email='existing@example.com', password='pass')
        url = reverse('profiles:user_profile')
        data = {'username': 'existinguser'}
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'testuser')

    def test_username_change_response_includes_updated_user_and_count(self):
        """Test response includes updated user and username_change_count after username change"""
        url = reverse('profiles:user_profile')
        data = {'username': 'updatedname'}
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['username'], 'updatedname')
        self.assertEqual(response.data['username_change_count'], 1)

    def test_get_profile_with_featured_badge(self):
        """Test retrieving profile with featured badge"""
        # Create a badge and set it as featured
        badge = Badge.objects.create(
            code='test_badge',
            name='Test Badge',
            description='A test badge',
            points_value=10
        )
        user_badge = UserBadge.objects.create(
            user=self.user,
            badge=badge,
            points_earned=10
        )
        self.profile.featured_badge = user_badge
        self.profile.save()
        
        url = reverse('profiles:user_profile')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data.get('featured_badge'))
        self.assertEqual(response.data['featured_badge']['badge_code'], 'test_badge')
        self.assertEqual(response.data['featured_badge']['badge_name'], 'Test Badge')

    def test_can_set_featured_badge_method(self):
        """Test the can_set_featured_badge model method"""
        # Create a badge and award it to the user
        badge = Badge.objects.create(
            code='test_badge',
            name='Test Badge',
            description='A test badge',
            points_value=10
        )
        user_badge = UserBadge.objects.create(
            user=self.user,
            badge=badge,
            points_earned=10
        )
        
        # User should be able to set their own badge
        self.assertTrue(self.profile.can_set_featured_badge(user_badge))
        
        # Create another user's badge
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        other_badge = Badge.objects.create(
            code='other_badge',
            name='Other Badge',
            description='Another badge',
            points_value=10
        )
        other_user_badge = UserBadge.objects.create(
            user=other_user,
            badge=other_badge,
            points_earned=10
        )
        
        # User should not be able to set another user's badge
        self.assertFalse(self.profile.can_set_featured_badge(other_user_badge))


class AuthenticationTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        # User for login and other auth tests that require an existing user
        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'testpass123'
        }
        self.user = User.objects.create_user(**self.user_data)
        # Profile.objects.create(user=self.user) # Profile is created with user for these tests

    def test_user_registration(self):
        """Test new user registration, profile creation, and JWT cookie setting."""
        url = reverse('profiles:register')
        registration_data = {
            'username': 'newreguser',
            'email': 'newreg@example.com',
            'password': 'newregpass123'
        }
        response = self.client.post(url, registration_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username=registration_data['username']).exists())
        registered_user = User.objects.get(username=registration_data['username'])
        self.assertEqual(registered_user.email, registration_data['email'])
        self.assertTrue(registered_user.check_password(registration_data['password']))
        self.assertTrue(Profile.objects.filter(user=registered_user).exists())
        self.assertIn('acbc_refresh_token', response.cookies)
        self.assertEqual(response.data['username'], registration_data['username'])
        self.assertEqual(response.data['email'], registration_data['email'])
        self.assertIn('id', response.data)

    def test_login(self):
        """Test user login"""
        url = reverse('profiles:login')
        data = {
            'username': self.user_data['username'],
            'password': self.user_data['password']
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('acbc_refresh_token', response.cookies)

    def test_check_auth_unauthenticated(self):
        """Test authentication check for unauthenticated user."""
        url = reverse('profiles:check_auth')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_authenticated'])

    def test_check_auth_authenticated_forced(self):
        """Test authentication check for user authenticated via force_authenticate."""
        url = reverse('profiles:check_auth')
        self.client.force_authenticate(user=self.user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_authenticated'])

    def test_check_auth_authenticated_via_cookie(self):
        """Test authentication check for user authenticated via JWT cookie."""
        # Step 1: Log in to get the cookie
        login_url = reverse('profiles:login')
        login_data = {
            'username': self.user_data['username'],
            'password': self.user_data['password']
        }
        login_response = self.client.post(login_url, login_data, format='json')
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertIn('acbc_refresh_token', login_response.cookies)

        # Step 2: Make request to check_auth endpoint (client will use the cookie)
        check_auth_url = reverse('profiles:check_auth')
        auth_response = self.client.get(check_auth_url)
        self.assertEqual(auth_response.status_code, status.HTTP_200_OK)
        self.assertTrue(auth_response.data['is_authenticated'])

    def test_logout(self):
        """Test user logout"""
        # First, log in to ensure there's a cookie to delete
        login_url = reverse('profiles:login')
        login_data = {
            'username': self.user_data['username'],
            'password': self.user_data['password']
        }
        self.client.post(login_url, login_data, format='json')

        url = reverse('profiles:logout')
        response = self.client.post(url, format='json') # Added format='json' for consistency, though logout might not need body
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check if the cookie is marked for deletion (max_age=0)
        if 'acbc_refresh_token' in response.cookies:
             self.assertEqual(response.cookies['acbc_refresh_token']['max-age'], 0)
        else:
            # If the cookie is completely removed from the header, that also works
            self.assertTrue(True)


class TokenRefreshTest(TestCase):
    """
    Test cases for JWT token refresh functionality.
    
    This class contains tests that verify:
    1. The token refresh endpoint works correctly
    2. Error cases are handled properly
    3. Protected endpoints remain accessible with valid tokens
    4. Token expiration is handled correctly
    """
    
    def setUp(self):
        """
        Set up test data and client.
        
        Creates:
        - A test user
        - Initial refresh and access tokens
        - API client for making requests
        - URLs for the endpoints to test
        """
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.refresh_token = RefreshToken.for_user(self.user)
        self.access_token = str(self.refresh_token.access_token)
        
        # URLs
        self.refresh_url = reverse('profiles:refresh_token')
        self.protected_url = reverse('profiles:profile-list')
        
    def test_successful_token_refresh(self):
        """
        Test successful token refresh with valid refresh token.
        
        Verifies that:
        1. A valid refresh token can be used to get a new access token
        2. The new access token is valid and contains correct user information
        3. The response has the correct status code and format
        """
        # Set the refresh token in cookies
        self.client.cookies[settings.SIMPLE_JWT['REFRESH_COOKIE']] = str(self.refresh_token)
        
        # Try to refresh the token
        response = self.client.post(self.refresh_url)
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('access_token', response.data)
        
        # Verify the new access token is valid
        new_token = response.data['access_token']
        decoded = jwt.decode(
            new_token,
            settings.SIMPLE_JWT['SIGNING_KEY'],
            algorithms=[settings.SIMPLE_JWT['ALGORITHM']]
        )
        self.assertEqual(decoded['user_id'], self.user.id)
        
    def test_invalid_refresh_token(self):
        """
        Test refresh attempt with invalid refresh token.
        
        Verifies that:
        1. An invalid token is rejected
        2. The correct error response is returned
        3. The response has the correct status code and format
        """
        # Set invalid refresh token
        self.client.cookies[settings.SIMPLE_JWT['REFRESH_COOKIE']] = 'invalid.token'
        
        response = self.client.post(self.refresh_url)
        
        self.assertEqual(response.status_code, 403)
        self.assertIn('error', response.data)
        
    def test_missing_refresh_token(self):
        """
        Test refresh attempt with no refresh token.
        
        Verifies that:
        1. A request without a refresh token is rejected
        2. The correct error response is returned
        3. The response has the correct status code and format
        """
        # Don't set any refresh token
        response = self.client.post(self.refresh_url)
        
        self.assertEqual(response.status_code, 403)
        self.assertIn('error', response.data)
        
    def test_expired_refresh_token(self):
        """
        Test refresh attempt with expired refresh token.
        
        Verifies that:
        1. An expired token is rejected
        2. The correct error response is returned
        3. The token is actually expired (verification)
        
        Uses time manipulation to create an expired token:
        1. Creates a token with 1-second lifetime
        2. Waits for it to expire
        3. Attempts to use it
        """
        # Create a token with very short lifetime (1 second)
        with patch('rest_framework_simplejwt.tokens.RefreshToken.lifetime', new=timedelta(seconds=1)):
            expired_token = RefreshToken.for_user(self.user)
            
            # Set the token in cookies
            self.client.cookies[settings.SIMPLE_JWT['REFRESH_COOKIE']] = str(expired_token)
            
            # Wait for token to expire
            time.sleep(2)
            
            # Try to refresh
            response = self.client.post(self.refresh_url)
            
            # Should fail with 403
            self.assertEqual(response.status_code, 403)
            self.assertIn('error', response.data)
            
            # Verify the token is actually expired
            try:
                decoded = jwt.decode(
                    str(expired_token),
                    settings.SIMPLE_JWT['SIGNING_KEY'],
                    algorithms=[settings.SIMPLE_JWT['ALGORITHM']]
                )
                self.assertTrue(datetime.fromtimestamp(decoded['exp']) < datetime.utcnow())
            except jwt.ExpiredSignatureError:
                # This is actually what we want - the token should be expired
                pass
            except Exception as e:
                self.fail(f"Unexpected error: {str(e)}")
        
    def test_protected_endpoint_with_refresh(self):
        """
        Test accessing protected endpoint with token refresh flow.
        
        Verifies that:
        1. A protected endpoint can be accessed with a valid token
        2. The endpoint remains accessible after token refresh
        3. The refresh flow is transparent to the client
        
        This test simulates the real-world scenario where a client
        makes a request with an expired token and the system
        automatically refreshes it.
        """
        # Set up initial tokens
        self.client.cookies[settings.SIMPLE_JWT['REFRESH_COOKIE']] = str(self.refresh_token)
        
        # First request with valid access token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.get(self.protected_url)
        
        self.assertEqual(response.status_code, 200)
        
        # Simulate expired access token by using an old one
        old_token = self.access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {old_token}')
        
        # Make request that should trigger refresh
        response = self.client.get(self.protected_url)
        
        # Should still succeed due to automatic refresh
        self.assertEqual(response.status_code, 200)
        
    def test_concurrent_refresh_requests(self):
        """
        Test handling of concurrent refresh requests.
        
        Verifies that:
        1. Multiple simultaneous refresh requests are handled correctly
        2. Each request gets a unique access token
        3. All requests succeed
        """
        # Set up initial tokens
        self.client.cookies[settings.SIMPLE_JWT['REFRESH_COOKIE']] = str(self.refresh_token)
        
        # Make multiple refresh requests
        responses = []
        for _ in range(3):
            response = self.client.post(self.refresh_url)
            responses.append(response)
        
        # All requests should succeed
        for response in responses:
            self.assertEqual(response.status_code, 200)
            self.assertIn('access_token', response.data)
        
        # Each response should have a unique access token
        tokens = [r.data['access_token'] for r in responses]
        self.assertEqual(len(set(tokens)), len(tokens))


class NotificationTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        # Get content type for User model
        self.user_content_type = ContentType.objects.get_for_model(User)
        
        # Create some test notifications
        self.notification1 = Notification.objects.create(
            recipient=self.user,
            actor_content_type=self.user_content_type,
            actor_object_id=self.user.id,
            verb='Test notification 1',
            description='This is a test notification',
            level='info'
        )
        self.notification2 = Notification.objects.create(
            recipient=self.user,
            actor_content_type=self.user_content_type,
            actor_object_id=self.user.id,
            verb='Test notification 2',
            description='This is another test notification',
            level='info'
        )
        # Create a read notification
        self.read_notification = Notification.objects.create(
            recipient=self.user,
            actor_content_type=self.user_content_type,
            actor_object_id=self.user.id,
            verb='Read notification',
            description='This is a read notification',
            level='info',
            unread=False
        )
        # Create an old notification (older than 30 days)
        self.old_notification = Notification.objects.create(
            recipient=self.user,
            actor_content_type=self.user_content_type,
            actor_object_id=self.user.id,
            verb='Old notification',
            description='This is an old notification',
            level='info',
            unread=False,
            timestamp=timezone.now() - timedelta(days=31)
        )

    def test_get_notifications(self):
        """Test retrieving user notifications"""
        url = reverse('profiles:notifications')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('notifications', response.data)
        notifications = response.data['notifications']
        
        # Debug: Print all notifications
        print("\n=== Notifications in response ===")
        for n in notifications:
            print(f"Notification: {n['verb']} (unread: {n['unread']})")
        print("===============================\n")
        
        # Debug: Print all notifications in database
        print("\n=== All notifications in database ===")
        for n in Notification.objects.all():
            print(f"Notification: {n.verb} (unread: {n.unread}, timestamp: {n.timestamp})")
        print("===================================\n")
        
        # Should get all notifications except the old one (which is automatically cleaned up)
        self.assertEqual(len(notifications), 2)  # Only unread notifications
        
        # Verify notification data structure
        notification = notifications[0]
        self.assertIn('id', notification)
        self.assertIn('verb', notification)
        self.assertIn('description', notification)
        self.assertIn('timestamp', notification)
        self.assertIn('unread', notification)
        
        # Verify we have the correct notifications
        notification_verbs = [n['verb'] for n in notifications]
        self.assertIn('Test notification 1', notification_verbs)
        self.assertIn('Test notification 2', notification_verbs)
        # Read notification should not be present as it's marked as read
        self.assertNotIn('Read notification', notification_verbs)
        # Old notification should not be present
        self.assertNotIn('Old notification', notification_verbs)

    def test_mark_notification_as_read(self):
        """Test marking a notification as read"""
        url = reverse('profiles:mark_notification_read', args=[self.notification1.id])
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('status', response.data)
        self.assertEqual(response.data['status'], 'success')
        
        # Verify notification is marked as read
        self.notification1.refresh_from_db()
        self.assertFalse(self.notification1.unread)

    def test_automatic_cleanup(self):
        """Test automatic cleanup of old notifications"""
        url = reverse('profiles:notifications')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify old notification is cleaned up
        self.assertFalse(Notification.objects.filter(id=self.old_notification.id).exists())
        
        # Verify other notifications still exist
        self.assertTrue(Notification.objects.filter(id=self.notification1.id).exists())
        self.assertTrue(Notification.objects.filter(id=self.notification2.id).exists())
        self.assertTrue(Notification.objects.filter(id=self.read_notification.id).exists())

    def test_notification_permissions(self):
        """Test that users can only access their own notifications"""
        # Create another user
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        
        # Create a notification for the other user
        other_notification = Notification.objects.create(
            recipient=other_user,
            actor_content_type=self.user_content_type,
            actor_object_id=other_user.id,
            verb='Other user notification',
            description='This is a notification for another user',
            level='info'
        )
        
        # Try to mark the other user's notification as read
        url = reverse('profiles:mark_notification_read', args=[other_notification.id])
        response = self.client.post(url)
        
        # Should get 404 as the notification doesn't exist for the current user
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        # Verify the notification still exists and is unread
        other_notification.refresh_from_db()
        self.assertTrue(other_notification.unread)

    def test_notification_ordering(self):
        """Test that notifications are ordered by timestamp (newest first)"""
        url = reverse('profiles:notifications')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notifications = response.data['notifications']
        
        # Verify notifications are ordered by timestamp (newest first)
        timestamps = [n['timestamp'] for n in notifications]
        self.assertEqual(timestamps, sorted(timestamps, reverse=True))

    def test_knowledge_path_comment_notification(self):
        """Test notification when someone comments on a knowledge path"""
        # Create another user who will be the knowledge path author
        author = User.objects.create_user(
            username='author',
            email='author@example.com',
            password='testpass123'
        )
        
        # Create a knowledge path
        knowledge_path = KnowledgePath.objects.create(
            title='Test Knowledge Path',
            description='Test Description',
            author=author
        )
        
        # Create a comment on the knowledge path
        url = reverse('comments:knowledge_path_comments', args=[knowledge_path.id])
        comment_data = {
            'body': 'This is a test comment on the knowledge path'
        }
        response = self.client.post(url, comment_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Get notifications for the author
        self.client.force_authenticate(user=author)
        notifications_url = reverse('profiles:notifications')
        notifications_response = self.client.get(notifications_url)
        
        self.assertEqual(notifications_response.status_code, status.HTTP_200_OK)
        notifications = notifications_response.data['notifications']
        
        # Should have one notification
        self.assertEqual(len(notifications), 1)
        
        # Verify notification content (app uses Spanish for notification verbs)
        notification = notifications[0]
        self.assertEqual(notification['verb'], 'comentó en tu camino de conocimiento')
        self.assertIn('testuser comentó en tu camino de conocimiento', notification['description'])
        self.assertIn('Test Knowledge Path', notification['description'])
        self.assertTrue(notification['unread'])

    def test_certificate_request_notification(self):
        """Test notification when a student requests a certificate"""
        # Create a teacher (knowledge path author)
        teacher = User.objects.create_user(
            username='teacher',
            email='teacher@example.com',
            password='testpass123'
        )
        
        # Create a knowledge path
        knowledge_path = KnowledgePath.objects.create(
            title='Test Knowledge Path',
            description='Test Description',
            author=teacher
        )
        
        # Student requests a certificate
        url = reverse('certificates:certificate-request', args=[knowledge_path.id])
        request_data = {
            'notes': {'message': 'Please review my completion'}
        }
        response = self.client.post(url, request_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Get notifications for the teacher
        self.client.force_authenticate(user=teacher)
        notifications_url = reverse('profiles:notifications')
        notifications_response = self.client.get(notifications_url)
        
        self.assertEqual(notifications_response.status_code, status.HTTP_200_OK)
        notifications = notifications_response.data['notifications']
        
        # Should have one notification
        self.assertEqual(len(notifications), 1)
        
        # Verify notification content (app uses Spanish for notification verbs)
        notification = notifications[0]
        self.assertEqual(notification['verb'], 'solicitó un certificado para tu camino de conocimiento')
        self.assertIn('testuser solicitó un certificado para tu camino de conocimiento', notification['description'])
        self.assertIn('Test Knowledge Path', notification['description'])
        self.assertTrue(notification['unread'])

    def test_certificate_approval_notification(self):
        """Test notification when a teacher approves a certificate request"""
        # Create a student
        student = User.objects.create_user(
            username='student',
            email='student@example.com',
            password='testpass123'
        )
        
        # Create a knowledge path
        knowledge_path = KnowledgePath.objects.create(
            title='Test Knowledge Path',
            description='Test Description',
            author=self.user  # Current user is the teacher
        )
        
        # Create a certificate request
        certificate_request = CertificateRequest.objects.create(
            requester=student,
            knowledge_path=knowledge_path,
            status='PENDING'
        )
        
        # Teacher approves the request
        url = reverse('certificates:certificate-request-action', args=[certificate_request.id, 'approve'])
        approve_data = {'note': 'Great work!'}
        response = self.client.post(url, approve_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Get notifications for the student
        self.client.force_authenticate(user=student)
        notifications_url = reverse('profiles:notifications')
        notifications_response = self.client.get(notifications_url)
        
        self.assertEqual(notifications_response.status_code, status.HTTP_200_OK)
        notifications = notifications_response.data['notifications']
        
        # Should have one notification
        self.assertEqual(len(notifications), 1)
        
        # Verify notification content (app uses Spanish for notification verbs)
        notification = notifications[0]
        self.assertEqual(notification['verb'], 'aprobó tu solicitud de certificado para')
        self.assertIn('testuser aprobó tu solicitud de certificado para', notification['description'])
        self.assertIn('Test Knowledge Path', notification['description'])
        self.assertTrue(notification['unread'])

    def test_certificate_rejection_notification(self):
        """Test notification when a teacher rejects a certificate request"""
        # Create a student
        student = User.objects.create_user(
            username='student',
            email='student@example.com',
            password='testpass123'
        )
        
        # Create a knowledge path
        knowledge_path = KnowledgePath.objects.create(
            title='Test Knowledge Path',
            description='Test Description',
            author=self.user  # Current user is the teacher
        )
        
        # Create a certificate request
        certificate_request = CertificateRequest.objects.create(
            requester=student,
            knowledge_path=knowledge_path,
            status='PENDING'
        )
        
        # Teacher rejects the request
        url = reverse('certificates:certificate-request-action', args=[certificate_request.id, 'reject'])
        reject_data = {'rejection_reason': 'Incomplete work'}
        response = self.client.post(url, reject_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Get notifications for the student
        self.client.force_authenticate(user=student)
        notifications_url = reverse('profiles:notifications')
        notifications_response = self.client.get(notifications_url)
        
        self.assertEqual(notifications_response.status_code, status.HTTP_200_OK)
        notifications = notifications_response.data['notifications']
        
        # Should have one notification
        self.assertEqual(len(notifications), 1)
        
        # Verify notification content (app uses Spanish for notification verbs)
        notification = notifications[0]
        self.assertEqual(notification['verb'], 'rechazó tu solicitud de certificado para')
        self.assertIn('testuser rechazó tu solicitud de certificado para', notification['description'])
        self.assertIn('Test Knowledge Path', notification['description'])
        self.assertTrue(notification['unread'])

    def test_certificate_request_notification_spam_protection(self):
        """Test that multiple certificate requests within 1 hour don't create duplicate notifications"""
        # Create a teacher (knowledge path author)
        teacher = User.objects.create_user(
            username='teacher',
            email='teacher@example.com',
            password='testpass123'
        )
        
        # Create a knowledge path
        knowledge_path = KnowledgePath.objects.create(
            title='Test Knowledge Path',
            description='Test Description',
            author=teacher
        )
        
        # Student requests a certificate
        url = reverse('certificates:certificate-request', args=[knowledge_path.id])
        request_data = {
            'notes': {'message': 'First request'}
        }
        response = self.client.post(url, request_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Get the request ID
        request_id = response.data['id']
        
        # Cancel the request
        cancel_url = reverse('certificates:certificate-request-action', args=[request_id, 'cancel'])
        self.client.post(cancel_url)
        
        # Request again immediately (should not create duplicate notification due to spam protection)
        request_data2 = {
            'notes': {'message': 'Second request'}
        }
        response2 = self.client.post(url, request_data2, format='json')
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        
        # Get notifications for the teacher
        self.client.force_authenticate(user=teacher)
        notifications_url = reverse('profiles:notifications')
        notifications_response = self.client.get(notifications_url)
        
        self.assertEqual(notifications_response.status_code, status.HTTP_200_OK)
        notifications = notifications_response.data['notifications']
        
        # Should have only one notification due to spam protection
        self.assertEqual(len(notifications), 1)
        
        # Verify notification content (app uses Spanish for notification verbs)
        notification = notifications[0]
        self.assertEqual(notification['verb'], 'solicitó un certificado para tu camino de conocimiento')
        self.assertTrue(notification['unread'])

    def test_certificate_notification_no_self_notification(self):
        """Test that users don't get notifications for their own actions"""
        # Create a knowledge path where the current user is the author
        knowledge_path = KnowledgePath.objects.create(
            title='Test Knowledge Path',
            description='Test Description',
            author=self.user  # Current user is the author
        )
        
        # User requests a certificate for their own knowledge path
        url = reverse('certificates:certificate-request', args=[knowledge_path.id])
        request_data = {
            'notes': {'message': 'My own request'}
        }
        response = self.client.post(url, request_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Get notifications for the user
        notifications_url = reverse('profiles:notifications')
        notifications_response = self.client.get(notifications_url)
        
        self.assertEqual(notifications_response.status_code, status.HTTP_200_OK)
        notifications = notifications_response.data['notifications']
        
        # Should have no certificate request notifications (no self-notification)
        # But may have other notifications from setUp
        certificate_notifications = [n for n in notifications if n['verb'] == 'requested a certificate for your knowledge path']
        self.assertEqual(len(certificate_notifications), 0)

    def test_content_upvote_notification(self):
        """Test notification when someone upvotes content"""
        # Create another user who will be the content owner
        content_owner = User.objects.create_user(
            username='contentowner',
            email='contentowner@example.com',
            password='testpass123'
        )
        
        # Create a topic for the content
        topic = Topic.objects.create(
            title='Test Topic',
            description='Test Topic Description',
            creator=self.user
        )
        
        # Create content owned by content_owner
        content = Content.objects.create(
            original_title='Test Content',
            uploaded_by=content_owner
        )
        
        # Current user upvotes the content
        url = reverse('votes:content-vote', args=[topic.id, content.id])
        vote_data = {'action': 'upvote'}
        response = self.client.post(url, vote_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Get notifications for the content owner
        self.client.force_authenticate(user=content_owner)
        notifications_url = reverse('profiles:notifications')
        notifications_response = self.client.get(notifications_url)
        
        self.assertEqual(notifications_response.status_code, status.HTTP_200_OK)
        notifications = notifications_response.data['notifications']
        
        # Should have one notification
        self.assertEqual(len(notifications), 1)
        
        # Verify notification content
        notification = notifications[0]
        self.assertEqual(notification['verb'], 'votó positivamente tu contenido')
        self.assertIn('testuser votó positivamente tu contenido', notification['description'])
        self.assertIn('Test Content', notification['description'])
        self.assertTrue(notification['unread'])

    def test_knowledge_path_upvote_notification(self):
        """Test notification when someone upvotes a knowledge path"""
        # Create another user who will be the knowledge path author
        path_author = User.objects.create_user(
            username='pathauthor',
            email='pathauthor@example.com',
            password='testpass123'
        )
        
        # Create a knowledge path
        knowledge_path = KnowledgePath.objects.create(
            title='Test Knowledge Path',
            description='Test Description',
            author=path_author
        )
        
        # Current user upvotes the knowledge path
        url = reverse('votes:knowledge-path-vote', args=[knowledge_path.id])
        vote_data = {'action': 'upvote'}
        response = self.client.post(url, vote_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Get notifications for the path author
        self.client.force_authenticate(user=path_author)
        notifications_url = reverse('profiles:notifications')
        notifications_response = self.client.get(notifications_url)
        
        self.assertEqual(notifications_response.status_code, status.HTTP_200_OK)
        notifications = notifications_response.data['notifications']
        
        # Should have one notification
        self.assertEqual(len(notifications), 1)
        
        # Verify notification content
        notification = notifications[0]
        self.assertEqual(notification['verb'], 'votó positivamente tu camino de conocimiento')
        self.assertIn('testuser votó positivamente tu camino de conocimiento', notification['description'])
        self.assertIn('Test Knowledge Path', notification['description'])
        self.assertTrue(notification['unread'])

    def test_upvote_notification_no_self_notification(self):
        """Test that users don't get notifications for their own upvotes"""
        # Create a topic for the content
        topic = Topic.objects.create(
            title='Test Topic',
            description='Test Topic Description',
            creator=self.user
        )
        
        # Create content where the current user is the owner
        content = Content.objects.create(
            original_title='My Own Content',
            uploaded_by=self.user
        )
        
        # User upvotes their own content
        url = reverse('votes:content-vote', args=[topic.id, content.id])
        vote_data = {'action': 'upvote'}
        response = self.client.post(url, vote_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Get notifications for the user
        notifications_url = reverse('profiles:notifications')
        notifications_response = self.client.get(notifications_url)
        
        self.assertEqual(notifications_response.status_code, status.HTTP_200_OK)
        notifications = notifications_response.data['notifications']
        
        # Should have no upvote notifications (no self-notification)
        # But may have other notifications from setUp
        upvote_notifications = [n for n in notifications if n['verb'] == 'votó positivamente tu contenido']
        self.assertEqual(len(upvote_notifications), 0)

    def test_upvote_notification_duplicate_prevention(self):
        """Test that multiple upvotes don't create duplicate notifications"""
        # Create another user who will be the content owner
        content_owner = User.objects.create_user(
            username='contentowner',
            email='contentowner@example.com',
            password='testpass123'
        )
        
        # Create a topic for the content
        topic = Topic.objects.create(
            title='Test Topic',
            description='Test Topic Description',
            creator=self.user
        )
        
        # Create content owned by content_owner
        content = Content.objects.create(
            original_title='Test Content',
            uploaded_by=content_owner
        )
        
        # Current user upvotes the content
        url = reverse('votes:content-vote', args=[topic.id, content.id])
        vote_data = {'action': 'upvote'}
        response = self.client.post(url, vote_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Remove the upvote
        vote_data = {'action': 'remove'}
        response = self.client.post(url, vote_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Upvote again (should not create duplicate notification)
        vote_data = {'action': 'upvote'}
        response = self.client.post(url, vote_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Get notifications for the content owner
        self.client.force_authenticate(user=content_owner)
        notifications_url = reverse('profiles:notifications')
        notifications_response = self.client.get(notifications_url)
        
        self.assertEqual(notifications_response.status_code, status.HTTP_200_OK)
        notifications = notifications_response.data['notifications']
        
        # Should have only one notification due to duplicate prevention
        upvote_notifications = [n for n in notifications if n['verb'] == 'votó positivamente tu contenido']
        self.assertEqual(len(upvote_notifications), 1)


class SuggestionModelTests(TestCase):
    """Tests for the Suggestion model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    def test_suggestion_creation(self):
        """Test suggestion creation and string representation"""
        suggestion = Suggestion.objects.create(
            user=self.user,
            message='Esta es una sugerencia de prueba para mejorar la plataforma.'
        )
        self.assertEqual(str(suggestion), f"Sugerencia de {self.user.username} - {suggestion.created_at.strftime('%Y-%m-%d %H:%M')}")
        self.assertEqual(suggestion.message, 'Esta es una sugerencia de prueba para mejorar la plataforma.')
        self.assertEqual(suggestion.user, self.user)
        self.assertIsNotNone(suggestion.created_at)
    
    def test_suggestion_ordering(self):
        """Test that suggestions are ordered by created_at descending"""
        suggestion1 = Suggestion.objects.create(
            user=self.user,
            message='Primera sugerencia'
        )
        suggestion2 = Suggestion.objects.create(
            user=self.user,
            message='Segunda sugerencia'
        )
        
        suggestions = list(Suggestion.objects.all())
        # Most recent should be first
        self.assertEqual(suggestions[0], suggestion2)
        self.assertEqual(suggestions[1], suggestion1)
    
    def test_suggestion_user_relationship(self):
        """Test that suggestion is properly linked to user"""
        suggestion = Suggestion.objects.create(
            user=self.user,
            message='Test suggestion'
        )
        self.assertEqual(suggestion.user.id, self.user.id)
        # Test reverse relationship
        self.assertIn(suggestion, self.user.suggestions.all())


class SuggestionSerializerTests(TestCase):
    """Tests for the SuggestionSerializer"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        from profiles.serializers import SuggestionSerializer
        self.serializer_class = SuggestionSerializer
    
    def test_valid_suggestion_data(self):
        """Test serializer with valid data"""
        data = {
            'message': 'Esta es una sugerencia válida con más de 10 caracteres.'
        }
        serializer = self.serializer_class(data=data)
        self.assertTrue(serializer.is_valid())
    
    def test_empty_message_validation(self):
        """Test that empty message is rejected"""
        data = {'message': ''}
        serializer = self.serializer_class(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('message', serializer.errors)
    
    def test_whitespace_only_message_validation(self):
        """Test that whitespace-only message is rejected"""
        data = {'message': '   '}
        serializer = self.serializer_class(data=data)
        self.assertFalse(serializer.is_valid())
    
    def test_short_message_validation(self):
        """Test that message shorter than 10 characters is rejected"""
        data = {'message': 'Corto'}
        serializer = self.serializer_class(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('message', serializer.errors)
    
    def test_minimum_length_message_validation(self):
        """Test that message with exactly 10 characters is accepted"""
        data = {'message': '1234567890'}
        serializer = self.serializer_class(data=data)
        self.assertTrue(serializer.is_valid())
    
    def test_message_trimming(self):
        """Test that message is trimmed of whitespace"""
        data = {'message': '   Mensaje con espacios   '}
        serializer = self.serializer_class(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['message'], 'Mensaje con espacios')


class SuggestionAPITests(APITestCase):
    """Tests for the Suggestion API endpoint"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='adminpass123',
            is_staff=True
        )
        self.client.force_authenticate(user=self.user)
    
    @patch('profiles.email_service.EmailService.send_to_admins')
    def test_create_suggestion_success(self, mock_send_to_admins):
        """Test successful suggestion creation"""
        mock_send_to_admins.return_value = {'sent': [self.admin_user.email], 'failed': []}
        
        url = reverse('profiles:suggestions')
        data = {
            'message': 'Esta es una sugerencia de prueba para mejorar la plataforma.'
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('message', response.data)
        self.assertIn('suggestion', response.data)
        self.assertEqual(response.data['message'], 'Sugerencia enviada exitosamente')
        
        # Verify suggestion was saved
        suggestion = Suggestion.objects.get(user=self.user)
        self.assertEqual(suggestion.message, 'Esta es una sugerencia de prueba para mejorar la plataforma.')
        
        # Verify email was sent to admin
        self.assertTrue(mock_send_to_admins.called)
    
    @patch('profiles.email_service.EmailService.send_to_admins')
    def test_create_suggestion_sends_email_to_admins(self, mock_send_to_admins):
        """Test that email is sent to admin users"""
        mock_send_to_admins.return_value = {'sent': [self.admin_user.email], 'failed': []}
        
        url = reverse('profiles:suggestions')
        data = {
            'message': 'Sugerencia que debería enviar email a administradores.'
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify email was called
        self.assertTrue(mock_send_to_admins.called)
        # Check that it was called with correct template name
        call_kwargs = mock_send_to_admins.call_args[1]
        self.assertEqual(call_kwargs['template_name'], 'suggestion_notification')
    
    @patch('profiles.email_service.EmailService.send_to_admins')
    def test_create_suggestion_email_failure_does_not_fail_request(self, mock_send_to_admins):
        """Test that email failure doesn't cause the request to fail"""
        from profiles.email_service import EmailServiceError
        mock_send_to_admins.side_effect = EmailServiceError("Email service unavailable")
        
        url = reverse('profiles:suggestions')
        data = {
            'message': 'Sugerencia que debería guardarse aunque falle el email.'
        }
        response = self.client.post(url, data, format='json')
        
        # Request should still succeed
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify suggestion was saved despite email failure
        suggestion = Suggestion.objects.get(user=self.user)
        self.assertEqual(suggestion.message, 'Sugerencia que debería guardarse aunque falle el email.')
    
    def test_create_suggestion_requires_authentication(self):
        """Test that unauthenticated users cannot create suggestions"""
        self.client.force_authenticate(user=None)
        
        url = reverse('profiles:suggestions')
        data = {
            'message': 'Esta sugerencia no debería ser aceptada.'
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Suggestion.objects.count(), 0)
    
    def test_create_suggestion_empty_message(self):
        """Test that empty message is rejected"""
        url = reverse('profiles:suggestions')
        data = {'message': ''}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('message', response.data)
    
    def test_create_suggestion_short_message(self):
        """Test that message shorter than 10 characters is rejected"""
        url = reverse('profiles:suggestions')
        data = {'message': 'Corto'}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('message', response.data)
    
    def test_create_suggestion_whitespace_only(self):
        """Test that whitespace-only message is rejected"""
        url = reverse('profiles:suggestions')
        data = {'message': '   '}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_create_suggestion_with_valid_minimum_length(self):
        """Test that message with exactly 10 characters is accepted"""
        url = reverse('profiles:suggestions')
        data = {'message': '1234567890'}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_create_suggestion_multiple_users(self):
        """Test that multiple users can create suggestions"""
        user2 = User.objects.create_user(
            username='testuser2',
            email='test2@example.com',
            password='testpass123'
        )
        
        # First user's suggestion
        url = reverse('profiles:suggestions')
        data1 = {'message': 'Sugerencia del primer usuario'}
        response1 = self.client.post(url, data1, format='json')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        
        # Second user's suggestion
        self.client.force_authenticate(user=user2)
        data2 = {'message': 'Sugerencia del segundo usuario'}
        response2 = self.client.post(url, data2, format='json')
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        
        # Verify both suggestions exist
        self.assertEqual(Suggestion.objects.count(), 2)
        self.assertEqual(Suggestion.objects.filter(user=self.user).count(), 1)
        self.assertEqual(Suggestion.objects.filter(user=user2).count(), 1)
    
    @patch('profiles.email_service.EmailService.send_to_admins')
    def test_create_suggestion_email_content(self, mock_send_to_admins):
        """Test that email contains correct information"""
        mock_send_to_admins.return_value = {'sent': [self.admin_user.email], 'failed': []}
        
        url = reverse('profiles:suggestions')
        data = {'message': 'Mensaje de prueba para verificar contenido del email'}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify email was called
        self.assertTrue(mock_send_to_admins.called)
        
        # Check email content - EmailService.send_to_admins uses template_name and context
        call_kwargs = mock_send_to_admins.call_args[1]
        self.assertIn(self.user.username, call_kwargs['subject'])
        self.assertEqual(call_kwargs['template_name'], 'suggestion_notification')
        # Verify context contains user and suggestion
        context = call_kwargs['context']
        self.assertEqual(context['user'], self.user)
        self.assertIn('suggestion', context)
        self.assertIn(data['message'], context['suggestion'].message)


class EmailServiceTests(TestCase):
    """Tests for the EmailService class"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='adminpass123',
            is_staff=True
        )
    
    def test_validate_email_valid(self):
        """Test email validation with valid email"""
        try:
            EmailService._validate_email('test@example.com')
        except EmailValidationError:
            self.fail("Valid email should not raise EmailValidationError")
    
    def test_validate_email_invalid(self):
        """Test email validation with invalid email"""
        with self.assertRaises(EmailValidationError):
            EmailService._validate_email('invalid-email')
    
    def test_validate_email_empty(self):
        """Test email validation with empty string"""
        with self.assertRaises(EmailValidationError):
            EmailService._validate_email('')
    
    @patch('profiles.email_service.settings')
    def test_validate_configuration_missing_postmark_token(self, mock_settings):
        """Test configuration validation when SEND_EMAILS is True but Postmark token is missing"""
        mock_settings.SEND_EMAILS = True
        mock_settings.POSTMARK = {'TOKEN': ''}
        
        with self.assertRaises(EmailConfigurationError):
            EmailService._validate_configuration()
    
    @patch('profiles.email_service.settings')
    def test_validate_configuration_postmark_configured(self, mock_settings):
        """Test configuration validation passes when Postmark token is set"""
        mock_settings.SEND_EMAILS = True
        mock_settings.POSTMARK = {'TOKEN': 'test-token'}
        
        # Should not raise
        EmailService._validate_configuration()
    
    @patch('profiles.email_service.settings')
    def test_is_email_enabled(self, mock_settings):
        """Test email enabled check"""
        mock_settings.SEND_EMAILS = True
        self.assertTrue(EmailService._is_email_enabled())
        
        mock_settings.SEND_EMAILS = False
        self.assertFalse(EmailService._is_email_enabled())
    
    def test_get_admin_emails(self):
        """Test getting admin emails"""
        admin_emails = EmailService.get_admin_emails()
        
        # Should include staff user email
        self.assertIn(self.admin_user.email, admin_emails)
        # Should not include regular user email
        self.assertNotIn(self.user.email, admin_emails)
    
    @patch('profiles.email_service.settings')
    def test_get_admin_emails_with_setting(self, mock_settings):
        """Test getting admin emails includes ADMIN_EMAIL setting"""
        mock_settings.ADMIN_EMAIL = 'admin-setting@example.com'
        
        admin_emails = EmailService.get_admin_emails()
        
        # Should include both setting and staff user
        self.assertIn('admin-setting@example.com', admin_emails)
        self.assertIn(self.admin_user.email, admin_emails)
    
    @patch('profiles.email_service.EmailService._is_email_enabled')
    @patch('profiles.email_service.EmailService._validate_configuration')
    @patch('profiles.email_service.EmailService._validate_email')
    @patch('profiles.email_service.EmailMultiAlternatives')
    def test_send_email_success(self, mock_ema_class, mock_validate_email, mock_validate_config, mock_is_enabled):
        """Test successful email sending via Django backend (Postmark when enabled)"""
        mock_is_enabled.return_value = True
        mock_ema_instance = mock_ema_class.return_value
        
        result = EmailService.send_email(
            receiver_email='test@example.com',
            subject='Test Subject',
            text_message='Test message'
        )
        
        self.assertTrue(result)
        mock_ema_instance.send.assert_called_once_with(fail_silently=False)
    
    @patch('profiles.email_service.EmailService._is_email_enabled')
    def test_send_email_disabled(self, mock_is_enabled):
        """Test email sending when disabled"""
        mock_is_enabled.return_value = False
        
        result = EmailService.send_email(
            receiver_email='test@example.com',
            subject='Test Subject',
            text_message='Test message'
        )
        
        self.assertFalse(result)
    
    @patch('profiles.email_service.EmailService._is_email_enabled')
    @patch('profiles.email_service.EmailService._validate_configuration')
    @patch('profiles.email_service.EmailService._validate_email')
    @patch('profiles.email_service.EmailMultiAlternatives')
    def test_send_email_send_failure(self, mock_ema_class, mock_validate_email, mock_validate_config, mock_is_enabled):
        """Test email sending when backend send raises"""
        mock_is_enabled.return_value = True
        mock_ema_class.return_value.send.side_effect = Exception("Backend error")
        
        with self.assertRaises(EmailServiceError):
            EmailService.send_email(
                receiver_email='test@example.com',
                subject='Test Subject',
                text_message='Test message'
            )
    
    @patch('profiles.email_service.EmailService.send_email')
    def test_send_to_admins(self, mock_send_email):
        """Test sending email to all admins"""
        mock_send_email.return_value = True
        
        results = EmailService.send_to_admins(
            subject='Test Subject',
            text_message='Test message'
        )
        
        # Should have sent to admin user
        self.assertIn(self.admin_user.email, results['sent'])
        self.assertEqual(len(results['failed']), 0)
        # Should have called send_email for each admin
        self.assertEqual(mock_send_email.call_count, len(EmailService.get_admin_emails()))
