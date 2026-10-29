"""Regression tests for full-document consultation routing and coverage."""
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from content.models import Content, ContentEmbedding, ContentTranscript, Topic, TopicChatQuery
from utils.openai_client import OpenAIClient, OpenAIClientError
from content.topic_chat import (
    TopicChatError, extract_entity_keywords, is_document_request, run_topic_chat,
)


@override_settings(OPENAI_API_KEY='test', QDRANT_URL='https://example.invalid',
                   QDRANT_API_KEY='test', TOPIC_CHAT_MAX_CONTEXT_CHARS=12000)
class DocumentConsultationTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='document-reader')
        self.topic = Topic.objects.create(title='Document topic', creator=self.user,
                                          is_public=True, chat_enabled=True)
        self.document = self.add_document('FIRST passage.\nLAST passage.')
        self.openai = Mock()
        self.openai.chat.return_value = 'Resumen con cita [1].'
        self.qdrant = Mock()
        self.client.force_authenticate(self.user)

    def add_document(self, text, topic=None):
        content = Content.objects.create(uploaded_by=self.user, media_type='TEXT',
                                         original_title='Stored document')
        content.topics.add(topic or self.topic)
        transcript = ContentTranscript.objects.create(content=content, processed_plain=text)
        ContentEmbedding.objects.update_or_create(content=content, defaults={
            'status': ContentEmbedding.STATUS_INDEXED, 'source_hash': transcript.text_hash,
        })
        return content

    def run_summary(self, **kwargs):
        return run_topic_chat(topic_id=self.topic.id, topic_title=self.topic.title,
                              message=kwargs.pop('message', 'Puedes resumir el texto?'),
                              content_ids=kwargs.pop('content_ids', [self.document.id]),
                              openai_client=self.openai, qdrant_client=self.qdrant, **kwargs)

    def test_generic_summary_bypasses_similarity_and_covers_entire_text(self):
        result = self.run_summary()
        self.openai.embed.assert_not_called()
        self.qdrant.search.assert_not_called()
        prompt = self.openai.chat.call_args.args[0][1]['content']
        self.assertIn('FIRST passage.', prompt)
        self.assertIn('LAST passage.', prompt)
        self.assertEqual(result['used_chunk_count'], 1)
        self.assertEqual(result['sources'][0]['content_id'], self.document.id)
        self.assertIsNone(result['sources'][0]['score'])
        self.assertIsNone(result['sources'][0]['chunk_index'])
        self.assertNotIn('text', result['sources'][0])

    def test_long_document_all_sections_reach_model_in_order(self):
        text = ''.join(f'SECTION-{i:02d} ' + 'x' * 7800 for i in range(4)) + 'THE END'
        transcript = self.document.transcript
        transcript.processed_plain = text
        transcript.save()
        ContentEmbedding.objects.filter(content=self.document).update(status='indexed')
        self.openai.chat.return_value = 'Section notes [1] [2] [3] [4].'
        result = self.run_summary()
        calls = self.openai.chat.call_args_list
        section_prompts = [call.args[0][1]['content'] for call in calls[:-1]]
        for i in range(4):
            self.assertIn(f'SECTION-{i:02d}', ''.join(section_prompts))
        self.assertIn('THE END', section_prompts[-1])
        self.assertGreater(result['used_chunk_count'], 2)
        self.assertEqual(self.openai.chat.call_count, result['used_chunk_count'] + 1)
        self.assertIn('[4]', calls[-1].args[0][1]['content'])

    def test_all_selected_documents_are_covered(self):
        other = self.add_document('OTHER document conclusion.')
        result = self.run_summary(content_ids=[self.document.id, other.id])
        self.assertEqual({s['content_id'] for s in result['sources']},
                         {self.document.id, other.id})
        self.assertIn('OTHER document conclusion.', self.openai.chat.call_args.args[0][1]['content'])

    def test_ambiguous_unselected_summary_requires_selection(self):
        self.add_document('Another document.')
        with self.assertRaises(TopicChatError) as error:
            self.run_summary(content_ids=None)
        self.assertEqual(error.exception.status_code, 400)
        self.openai.chat.assert_not_called()

    def test_only_document_can_be_resolved_without_selection(self):
        self.assertEqual(self.run_summary(content_ids=None)['used_chunk_count'], 1)

    def test_foreign_document_cannot_enter_summary(self):
        other_topic = Topic.objects.create(title='Other', creator=self.user)
        other = self.add_document('SECRET', topic=other_topic)
        with self.assertRaises(TopicChatError):
            self.run_summary(content_ids=[self.document.id, other.id])
        self.openai.chat.assert_not_called()

    @patch('content.topic_chat.OpenAIClient')
    def test_api_saves_success_and_sources(self, client_class):
        client_class.return_value = self.openai
        response = self.client.post(f'/api/content/topics/{self.topic.id}/chat/',
                                    {'message': 'Puedes resumir el texto?',
                                     'content_ids': [self.document.id]}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(TopicChatQuery.objects.count(), 1)
        self.assertEqual(response.data['used_chunk_count'], 1)
        self.assertEqual(response.data['selected_content_ids'], [self.document.id])

    @patch('content.topic_chat.OpenAIClient')
    def test_oversize_request_does_not_spend_or_save_consultation(self, client_class):
        client_class.return_value = self.openai
        transcript = self.document.transcript
        transcript.processed_plain = 'x' * (8000 * 32 + 1)
        transcript.save()
        ContentEmbedding.objects.filter(content=self.document).update(status='indexed')
        response = self.client.post(f'/api/content/topics/{self.topic.id}/chat/',
                                    {'message': 'Resume el texto',
                                     'content_ids': [self.document.id]}, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.openai.chat.assert_not_called()
        self.assertEqual(TopicChatQuery.objects.count(), 0)

    def test_instruction_words_are_not_entities(self):
        self.assertEqual(extract_entity_keywords('Puedes resumir el texto?'), [])
        self.assertEqual(extract_entity_keywords('Resume el texto'), [])
        self.assertIn('Adam Back', extract_entity_keywords('Qué dice Adam Back?'))

    def test_factual_questions_keep_semantic_path(self):
        self.assertFalse(is_document_request('Qué dice sobre Bitcoin?'))
        self.qdrant.search.return_value = []
        self.run_summary(message='qué dice sobre bitcoin?')
        self.openai.embed.assert_called_once()
        self.qdrant.search.assert_called_once()
        self.openai.chat.assert_not_called()

    @patch('content.topic_chat.OpenAIClient')
    def test_model_failure_does_not_save_partial_summary(self, client_class):
        client_class.return_value = self.openai
        self.openai.chat.side_effect = OpenAIClientError('incomplete')
        response = self.client.post(f'/api/content/topics/{self.topic.id}/chat/',
                                    {'message': 'Summarize this text',
                                     'content_ids': [self.document.id]}, format='json')
        self.assertEqual(response.status_code, 502, response.data)
        self.assertEqual(TopicChatQuery.objects.count(), 0)

    def test_summary_rejects_truncated_upstream_output(self):
        upstream = OpenAIClient(api_key='test')
        with patch.object(upstream, '_request', return_value={'choices': [{
            'finish_reason': 'length', 'message': {'content': 'incomplete'},
        }]}):
            with self.assertRaises(OpenAIClientError):
                upstream.chat([], require_complete=True)

    def test_document_request_variants(self):
        for message in ('Resúmelo', 'Haz un resumen', 'Summarise this text',
                        'Explain this document', 'Explica este texto',
                        'Cuáles son las ideas principales?'):
            with self.subTest(message=message):
                self.assertTrue(is_document_request(message))
