from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from content.models import Content, ContentProfile, Topic
from knowledge_paths.models import KnowledgePath

# Create your tests here.

class SearchAPITests(APITestCase):
    def setUp(self):
        # Create Content and ContentProfile
        self.content1 = Content.objects.create(original_title="Blockchain Basics", original_author="Alice", media_type="TEXT")
        self.profile1 = ContentProfile.objects.create(content=self.content1, title="Blockchain Basics", author="Alice", is_visible=True)
        self.content2 = Content.objects.create(original_title="Ethereum Guide", original_author="Bob", media_type="VIDEO")
        self.profile2 = ContentProfile.objects.create(content=self.content2, title="Ethereum Guide", author="Bob", is_visible=True)
        # Invisible profile (should not appear)
        self.profile3 = ContentProfile.objects.create(content=self.content2, title="Hidden", author="Bob", is_visible=False)

        # Create Topics
        self.topic1 = Topic.objects.create(title="Smart Contracts", description="All about smart contracts")
        self.topic2 = Topic.objects.create(title="Consensus", description="Consensus mechanisms")

        # Create Knowledge Paths
        self.kp1 = KnowledgePath.objects.create(title="Intro to Blockchain", description="Start here")
        self.kp2 = KnowledgePath.objects.create(title="Advanced Blockchain", description="Deep dive")

    def test_search_content(self):
        url = reverse('search:search')
        response = self.client.get(url, {'q': 'blockchain', 'type': 'content'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(r['title'] == "Blockchain Basics" for r in response.data['results']))
        # Should not include invisible profile
        self.assertFalse(any(r['title'] == "Hidden" for r in response.data['results']))

    def test_search_topics(self):
        url = reverse('search:search')
        response = self.client.get(url, {'q': 'smart', 'type': 'topics'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(r['title'] == "Smart Contracts" for r in response.data['results']))

    def test_search_knowledge_paths(self):
        url = reverse('search:search')
        response = self.client.get(url, {'q': 'intro', 'type': 'knowledge_paths'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(r['title'] == "Intro to Blockchain" for r in response.data['results']))

    def test_search_all_types(self):
        url = reverse('search:search')
        response = self.client.get(url, {'q': 'blockchain', 'type': 'all'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should include both content and knowledge path
        titles = [r['title'] for r in response.data['results']]
        self.assertIn("Blockchain Basics", titles)
        self.assertIn("Intro to Blockchain", titles)

    def test_search_no_results(self):
        url = reverse('search:search')
        response = self.client.get(url, {'q': 'nonexistent', 'type': 'all'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 0)

    def test_search_missing_query(self):
        url = reverse('search:search')
        response = self.client.get(url, {'type': 'all'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_search_pagination(self):
        url = reverse('search:search')
        # Create extra topics to force pagination
        for i in range(15):
            Topic.objects.create(title=f"Extra Topic {i}", description="Extra")
        response = self.client.get(url, {'q': 'Extra', 'type': 'topics', 'page_size': 10})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 10)
        self.assertGreater(response.data['count'], 10)
        self.assertEqual(response.data['current_page'], 1)
        self.assertGreaterEqual(response.data['total_pages'], 2)
