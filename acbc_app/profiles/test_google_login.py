import json
from unittest.mock import patch

from allauth.socialaccount.models import SocialAccount
from django.contrib.auth.models import User
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

GOOGLE_SETTINGS = {
    'SOCIALACCOUNT_PROVIDERS': {
        'google': {
            'APP': {
                'client_id': 'test-client-id',
                'secret': 'test-secret',
                'key': '',
            },
        },
    },
}


@override_settings(**GOOGLE_SETTINGS)
class GoogleLoginAPITests(APITestCase):
    def setUp(self):
        self.url = reverse('google_login')

    def _login(self, claims):
        certs = {'keys': [{'kid': 'kid-1'}]}
        with patch('profiles.views.requests.get') as get, \
                patch('profiles.views.jwt.get_unverified_header', return_value={'kid': 'kid-1'}), \
                patch('profiles.views.jwt.algorithms.RSAAlgorithm.from_jwk', return_value=object()), \
                patch('profiles.views.jwt.decode', return_value=claims):
            get.return_value.status_code = 200
            get.return_value.json.return_value = certs
            return self.client.post(
                self.url,
                {'access_token': 'signed-token'},
                format='json',
            )

    def test_first_login_creates_user_and_strips_token_for_sql_ascii(self):
        claims = {
            'sub': 'google-sub-1',
            'email': 'jose@example.com',
            'email_verified': True,
            'given_name': 'José',
            'family_name': 'Jiménez',
            'name': 'José Jiménez',
        }
        with patch('utils.db_encoding.is_sql_ascii_database', return_value=True):
            response = self._login(claims)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'jose')
        self.assertEqual(response.data['email'], 'jose@example.com')
        self.assertEqual(response.data['first_name'], 'José')
        self.assertIn('access_token', response.data)

        account = SocialAccount.objects.get(uid='google-sub-1')
        self.assertEqual(account.user.username, 'jose')
        self.assertEqual(account.extra_data['given_name'], 'Jose')
        self.assertEqual(account.extra_data['family_name'], 'Jimenez')
        self.assertEqual(account.extra_data['name'], 'Jose Jimenez')
        json.dumps(account.extra_data).encode('ascii')

        with patch('utils.db_encoding.is_sql_ascii_database', return_value=True):
            again = self._login(claims)
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(again.data['id'], response.data['id'])
        self.assertEqual(SocialAccount.objects.filter(uid='google-sub-1').count(), 1)
        self.assertEqual(User.objects.filter(email__iexact='jose@example.com').count(), 1)

    def test_links_existing_user_by_email_ignoring_case(self):
        existing = User.objects.create_user(
            username='already',
            email='Person@Example.com',
            password='pass12345',
            first_name='Ana',
        )
        response = self._login({
            'sub': 'google-sub-2',
            'email': 'person@example.com',
            'email_verified': True,
            'given_name': 'Ana',
            'family_name': 'Perez',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], existing.id)
        self.assertEqual(response.data['username'], 'already')
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(
            SocialAccount.objects.get(uid='google-sub-2').user_id,
            existing.id,
        )

    def test_rejects_unverified_email_without_creating_a_user(self):
        response = self._login({
            'sub': 'google-sub-3',
            'email': 'new@example.com',
            'email_verified': False,
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email='new@example.com').exists())
        self.assertFalse(SocialAccount.objects.filter(uid='google-sub-3').exists())

    def test_username_collision_and_invalid_characters(self):
        User.objects.create_user(
            username='jjimenez',
            email='taken@example.com',
            password='pass12345',
        )
        response = self._login({
            'sub': 'google-sub-4',
            'email': 'jjimenez@other.example',
            'email_verified': True,
            'given_name': 'Juan',
            'family_name': 'Jimenez',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'jjimenez1')

        odd = self._login({
            'sub': 'google-sub-5',
            'email': 'bad!name@example.com',
            'email_verified': True,
        })
        self.assertEqual(odd.status_code, status.HTTP_200_OK)
        self.assertEqual(odd.data['username'], 'badname')
