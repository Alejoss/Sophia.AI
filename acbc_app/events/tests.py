from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User


class EventAPITests(APITestCase):
    fixtures = ['events/fixtures/db_fixture.json', 'events/fixtures/event_fixture.json']

    @classmethod
    def setUpTestData(cls):
        cls.url = reverse('event-list')
        # Create a user here if it's not part of the fixtures or if you need a specific test user setup
        cls.user = User.objects.create_user(username='testuser', password='testpassword')

    def setUp(self):
        # This method is called before every test function
        self.client.login(username='testuser', password='testpassword')

    def test_get_events(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) > 0)  # Checks if any events are returned

    def test_specific_event_detail(self):
        # Assuming you have an event with PK=100 in your fixtures
        url = reverse('event-detail', args=[100])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Introduction to Machine Learning')
