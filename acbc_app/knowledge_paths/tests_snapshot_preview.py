"""Tests for knowledge-path snapshot preview builder and API."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from content.models import Content, ContentProfile, ContentTranscript
from content.transcript_utils import compute_text_hash, resolve_certified_plain_text
from knowledge_paths.models import KnowledgePath, Node
from knowledge_paths.knowledge_path_snapshot import transcript_text_sha256
from knowledge_paths.services.snapshot_preview import preview_knowledge_path_snapshot


class SnapshotPreviewBuilderTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(
            username="demo-teacher",
            password="pass",
        )
        self.path = KnowledgePath.objects.create(
            title="Introduction to Bitcoin",
            description="The full knowledge path description.",
            author=self.author,
        )
        self.content = Content.objects.create(
            media_type="VIDEO",
            original_title="What is Bitcoin?",
            uploaded_by=self.author,
        )
        self.transcript_text = "Bitcoin is digital money."
        ContentTranscript.objects.create(
            content=self.content,
            processed_plain=self.transcript_text,
        )
        self.profile = ContentProfile.objects.create(
            content=self.content,
            user=self.author,
            title="What is Bitcoin?",
        )
        self.node = Node.objects.create(
            knowledge_path=self.path,
            content_profile=self.profile,
            title="What is Bitcoin?",
            description="The complete node description, without truncation.",
            order=1,
            media_type="VIDEO",
        )

    def test_preview_embeds_transcript_text_and_digest(self):
        payload = preview_knowledge_path_snapshot(self.path, version=1)
        document = payload["document"]
        expected_text = resolve_certified_plain_text(self.content.transcript)

        self.assertEqual(document["schemaVersion"], "sophia-acbc-knowledge-path-v1")
        self.assertEqual(
            document["knowledgePathId"],
            f"sophia-acbc:knowledge-path:{self.path.id}",
        )
        self.assertTrue(payload["validForHash"])
        self.assertTrue(payload["readyForStrictPublish"])
        material = document["nodes"][0]["materials"][0]
        self.assertEqual(material["type"], "transcript")
        self.assertEqual(material["text"], expected_text)
        self.assertNotIn("uri", material)
        self.assertNotIn("contentHash", material)
        self.assertEqual(
            transcript_text_sha256(material["text"]),
            compute_text_hash(self.transcript_text),
        )

    def test_preview_allows_empty_text_without_transcript(self):
        ContentTranscript.objects.filter(content=self.content).delete()
        payload = preview_knowledge_path_snapshot(self.path, version=1)
        material = payload["document"]["nodes"][0]["materials"][0]
        self.assertEqual(material["type"], "source")
        self.assertEqual(material["text"], "")
        self.assertTrue(payload["validForHash"])
        self.assertFalse(payload["readyForStrictPublish"])
        codes = {issue["code"] for issue in payload["issues"]}
        self.assertIn("NO_TRANSCRIPT_TEXT", codes)


class SnapshotPreviewAPITests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username="author", password="pass")
        self.other = User.objects.create_user(username="other", password="pass")
        self.path = KnowledgePath.objects.create(
            title="Path",
            description="",
            author=self.author,
        )
        Node.objects.create(
            knowledge_path=self.path,
            title="Lesson",
            description="",
            order=1,
            media_type="TEXT",
        )
        self.client = APIClient()

    def test_author_can_get_preview(self):
        self.client.force_authenticate(user=self.author)
        response = self.client.get(
            f"/api/knowledge_paths/{self.path.id}/snapshot-preview/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("document", response.data)
        self.assertEqual(
            response.data["document"]["schemaVersion"],
            "sophia-acbc-knowledge-path-v1",
        )

    def test_non_author_forbidden(self):
        self.client.force_authenticate(user=self.other)
        response = self.client.get(
            f"/api/knowledge_paths/{self.path.id}/snapshot-preview/"
        )
        self.assertEqual(response.status_code, 403)
