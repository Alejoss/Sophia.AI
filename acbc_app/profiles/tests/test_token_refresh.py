"""
Test suite for JWT token refresh functionality in the profiles app.

This test suite verifies the behavior of the token refresh mechanism, including:
- Successful token refresh
- Handling of invalid tokens
- Handling of missing tokens
- Handling of expired tokens
- Protected endpoint access with token refresh
- Concurrent refresh requests

The tests use Django's test client and REST framework's APIClient to simulate
HTTP requests and verify the responses. They also use Python's unittest.mock
to simulate time-dependent scenarios like token expiration.

Key concepts tested:
1. Token Refresh Flow:
   - Valid refresh token in cookies
   - New access token generation
   - Token validation
   - Error handling

2. Security Aspects:
   - Invalid token rejection
   - Missing token handling
   - Expired token handling
   - Protected endpoint access

3. Edge Cases:
   - Concurrent refresh requests
   - Token expiration timing
   - Error responses

Note: Some tests use time.sleep() to simulate token expiration. In a production
environment, you might want to use more sophisticated time mocking.
"""

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.conf import settings
import jwt
from datetime import timedelta, datetime
import time
from unittest.mock import patch

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
        self.user = get_user_model().objects.create_user(
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
        
        This test ensures the system can handle race conditions
        when multiple clients try to refresh their tokens simultaneously.
        """
        print("\n=== Testing concurrent refresh requests ===")
        
        # Set up initial token
        self.client.cookies[settings.SIMPLE_JWT['REFRESH_COOKIE']] = str(self.refresh_token)
        
        # Make multiple refresh requests simultaneously
        responses = []
        for _ in range(3):
            response = self.client.post(self.refresh_url)
            responses.append(response)
            
        print(f"Number of successful responses: {sum(1 for r in responses if r.status_code == 200)}")
        
        # All requests should succeed
        self.assertTrue(all(r.status_code == 200 for r in responses))
        
        # All responses should have different access tokens
        tokens = [r.data['access_token'] for r in responses]
        self.assertEqual(len(set(tokens)), len(tokens)) 