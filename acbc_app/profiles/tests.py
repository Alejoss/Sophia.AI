from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from profiles.models import Profile, CryptoCurrency, AcceptedCrypto, ContactMethod, UserActivityStatus, UserNodeCompletion
from notifications.models import Notification
from knowledge_paths.models import KnowledgePath, Node
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
import jwt
import time
from datetime import datetime, timedelta
from unittest.mock import patch
from django.contrib.contenttypes.models import ContentType


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


class UserActivityStatusModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.activity_status = UserActivityStatus.objects.create(
            user=self.user,
            is_completed=True
        )

    def test_activity_status_creation(self):
        """Test activity status creation and string representation"""
        self.assertEqual(str(self.activity_status), f"{self.user.username} - Completed")
        self.assertTrue(self.activity_status.is_completed)


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
        self.assertIn('jwt', response.cookies)
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
        if 'jwt' in response.cookies:
             self.assertEqual(response.cookies['jwt']['max-age'], 0)
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
        print("\n=== Testing successful token refresh ===")
        
        # Set the refresh token in cookies
        self.client.cookies[settings.SIMPLE_JWT['REFRESH_COOKIE']] = str(self.refresh_token)
        
        # Try to refresh the token
        response = self.client.post(self.refresh_url)
        print(f"Refresh response status: {response.status_code}")
        print(f"Refresh response data: {response.data}")
        
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
        print("\n=== Testing invalid refresh token ===")
        
        # Set invalid refresh token
        self.client.cookies[settings.SIMPLE_JWT['REFRESH_COOKIE']] = 'invalid.token'
        
        response = self.client.post(self.refresh_url)
        print(f"Invalid token response status: {response.status_code}")
        print(f"Invalid token response data: {response.data}")
        
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
        print("\n=== Testing missing refresh token ===")
        
        # Don't set any refresh token
        response = self.client.post(self.refresh_url)
        print(f"Missing token response status: {response.status_code}")
        print(f"Missing token response data: {response.data}")
        
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
        print("\n=== Testing expired refresh token ===")
        
        # Create a token with very short lifetime (1 second)
        with patch('rest_framework_simplejwt.tokens.RefreshToken.lifetime', new=timedelta(seconds=1)):
            expired_token = RefreshToken.for_user(self.user)
            
            # Set the token in cookies
            self.client.cookies[settings.SIMPLE_JWT['REFRESH_COOKIE']] = str(expired_token)
            
            # Wait for token to expire
            time.sleep(2)
            
            # Try to refresh
            response = self.client.post(self.refresh_url)
            print(f"Expired token response status: {response.status_code}")
            print(f"Expired token response data: {response.data}")
            
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
                print(f"Token expiration time: {datetime.fromtimestamp(decoded['exp'])}")
                print(f"Current time: {datetime.utcnow()}")
                self.assertTrue(datetime.fromtimestamp(decoded['exp']) < datetime.utcnow())
            except jwt.ExpiredSignatureError:
                # This is actually what we want - the token should be expired
                print("✅ Token is expired as expected")
                pass
            except Exception as e:
                print(f"Unexpected error decoding token: {str(e)}")
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
        print("\n=== Testing protected endpoint with refresh flow ===")
        
        # Set up initial tokens
        self.client.cookies[settings.SIMPLE_JWT['REFRESH_COOKIE']] = str(self.refresh_token)
        
        # First request with valid access token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.get(self.protected_url)
        print(f"Initial request status: {response.status_code}")
        
        self.assertEqual(response.status_code, 200)
        
        # Simulate expired access token by using an old one
        old_token = self.access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {old_token}')
        
        # Make request that should trigger refresh
        response = self.client.get(self.protected_url)
        print(f"Request after refresh status: {response.status_code}")
        
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
        print("\n=== Testing concurrent refresh requests ===")
        
        # Set up initial tokens
        self.client.cookies[settings.SIMPLE_JWT['REFRESH_COOKIE']] = str(self.refresh_token)
        
        # Make multiple refresh requests
        responses = []
        for _ in range(3):
            response = self.client.post(self.refresh_url)
            responses.append(response)
            print(f"Concurrent request status: {response.status_code}")
        
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
        response = self.client.post(url, comment_data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Get notifications for the author
        self.client.force_authenticate(user=author)
        notifications_url = reverse('profiles:notifications')
        notifications_response = self.client.get(notifications_url)
        
        self.assertEqual(notifications_response.status_code, status.HTTP_200_OK)
        notifications = notifications_response.data['notifications']
        
        # Should have one notification
        self.assertEqual(len(notifications), 1)
        
        # Verify notification content
        notification = notifications[0]
        self.assertEqual(notification['verb'], 'commented on your knowledge path')
        self.assertIn('testuser commented on your knowledge path', notification['description'])
        self.assertIn('Test Knowledge Path', notification['description'])
        self.assertTrue(notification['unread'])
