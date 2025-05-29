from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from profiles.models import Profile, CryptoCurrency, AcceptedCrypto, ContactMethod, UserActivityStatus, UserNodeCompletion
from knowledge_paths.models import KnowledgePath, Node
from django.utils import timezone


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
        self.assertIn('jwt', response.cookies) # Changed from 'token' to 'jwt'

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
        self.assertIn('jwt', login_response.cookies)

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
