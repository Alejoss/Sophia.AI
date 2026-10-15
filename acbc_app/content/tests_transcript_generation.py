"""Paid transcript generation: checkout, public text, and Consultas indexing."""
from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from content.models import Content, ContentEmbedding, TranscriptGenerationRequest
from payments.models import TokenLedgerEntry
from payments.token_ledger import credit_platform_tokens


@override_settings(TRANSCRIPT_INGEST_API_KEY='test-ingest-key')
class TranscriptGenerationAPITests(APITestCase):
    def setUp(self):
        self.buyer = User.objects.create_user(
            username='transcript-buyer',
            email='buyer@example.com',
            password='testpass123',
        )
        self.other = User.objects.create_user(
            username='transcript-other',
            email='other@example.com',
            password='testpass123',
        )
        self.video = Content.objects.create(
            uploaded_by=self.buyer,
            media_type='VIDEO',
            original_title='Clase sin transcripción',
        )
        self.image = Content.objects.create(
            uploaded_by=self.buyer,
            media_type='IMAGE',
            original_title='Una imagen',
        )
        self.ingest_header = {'HTTP_X_TRANSCRIPT_INGEST_KEY': 'test-ingest-key'}

    def test_offer_for_missing_transcript(self):
        response = self.client.get(
            f'/api/content/content_details/{self.video.id}/transcript/generation/',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['has_transcript'])
        self.assertTrue(response.data['can_request'])
        self.assertEqual(response.data['price_usd'], 1)
        self.assertEqual(response.data['price_tokens'], 100)
        self.assertIsNone(response.data['request'])

    def test_image_cannot_be_transcribed(self):
        self.client.force_authenticate(user=self.buyer)
        response = self.client.post(
            f'/api/content/content_details/{self.image.id}/transcript/generation/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_token_payment_queues_then_ingest_publishes_and_marks_embedding(self):
        self.client.force_authenticate(user=self.buyer)
        created = self.client.post(
            f'/api/content/content_details/{self.video.id}/transcript/generation/',
            {},
            format='json',
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        request_id = created.data['request']['id']

        credit_platform_tokens(
            user=self.buyer,
            amount=100,
            reason=TokenLedgerEntry.REASON_ADJUSTMENT,
        )
        paid = self.client.post(
            f'/api/payments/transcript-generation/{request_id}/tokens/',
            {},
            format='json',
        )
        self.assertEqual(paid.status_code, status.HTTP_200_OK, paid.data)
        self.assertEqual(paid.data['request']['status'], 'queued')
        self.assertEqual(paid.data['tokens_spent'], 100)
        self.assertEqual(paid.data['token_balance'], 0)

        queue = self.client.get(
            '/api/content/transcript-ingest/?funded_only=1',
            **self.ingest_header,
        )
        self.assertEqual(queue.status_code, status.HTTP_200_OK)
        self.assertEqual(queue.data['count'], 1)
        self.assertEqual(queue.data['items'][0]['id'], self.video.id)
        self.assertTrue(queue.data['items'][0]['generation_funded'])

        ingested = self.client.put(
            f'/api/content/transcript-ingest/{self.video.id}/',
            {'processed_plain': 'Texto público de la clase.', 'format': 'PLAIN', 'language': 'es'},
            format='json',
            **self.ingest_header,
        )
        self.assertEqual(ingested.status_code, status.HTTP_201_CREATED)

        generation = TranscriptGenerationRequest.objects.get(pk=request_id)
        self.assertEqual(generation.status, TranscriptGenerationRequest.STATUS_COMPLETED)

        public = self.client.get(f'/api/content/content_details/{self.video.id}/transcript/')
        self.assertEqual(public.status_code, status.HTTP_200_OK)
        self.assertIn('Texto público', public.data['text'])

        embedding = ContentEmbedding.objects.get(content=self.video)
        self.assertEqual(embedding.status, ContentEmbedding.STATUS_PENDING)

        again = self.client.post(
            f'/api/content/content_details/{self.video.id}/transcript/generation/',
            {},
            format='json',
        )
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

    def test_second_user_cannot_open_a_parallel_checkout(self):
        self.client.force_authenticate(user=self.buyer)
        first = self.client.post(
            f'/api/content/content_details/{self.video.id}/transcript/generation/',
            {},
            format='json',
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(user=self.other)
        second = self.client.post(
            f'/api/content/content_details/{self.video.id}/transcript/generation/',
            {},
            format='json',
        )
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
