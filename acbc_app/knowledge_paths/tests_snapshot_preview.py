"""Tests for knowledge-path snapshot preview builder and API."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from content.models import Content, ContentProfile, ContentTranscript
from content.transcript_utils import compute_text_hash
from knowledge_paths.models import KnowledgePath, Node
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
        self.expected_hash = compute_text_hash(self.transcript_text)
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

    def test_preview_includes_transcript_material_and_digest(self):
        payload = preview_knowledge_path_snapshot(self.path, version=1)
        document = payload["document"]

        self.assertEqual(document["schemaVersion"], "sophia-knowledge-path-v1")
        self.assertEqual(
            document["knowledgePathId"],
            f"sophia:knowledge-path:{self.path.id}",
        )
        self.assertTrue(payload["validForHash"])
        self.assertFalse(payload["readyForStrictPublish"])
        self.assertEqual(len(document["nodes"]), 1)
        material = document["nodes"][0]["materials"][0]
        self.assertEqual(material["type"], "transcript")
        self.assertEqual(material["contentHash"], self.expected_hash)
        self.assertEqual(material["coverage"], "missing")
        self.assertEqual(material["uri"], "")
        codes = {issue["code"] for issue in payload["issues"]}
        self.assertIn("IPFS_URI_PENDING", codes)

    def test_preview_allows_source_material_without_transcript(self):
        ContentTranscript.objects.filter(content=self.content).delete()
        payload = preview_knowledge_path_snapshot(self.path, version=1)
        material = payload["document"]["nodes"][0]["materials"][0]
        self.assertEqual(material["type"], "source")
        self.assertEqual(material["coverage"], "missing")
        self.assertNotIn("textFormat", material)
        self.assertTrue(payload["validForHash"])
        codes = {issue["code"] for issue in payload["issues"]}
        self.assertIn("NO_TRANSCRIPT", codes)


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
            "sophia-knowledge-path-v1",
        )

    def test_non_author_forbidden(self):
        self.client.force_authenticate(user=self.other)
        response = self.client.get(
            f"/api/knowledge_paths/{self.path.id}/snapshot-preview/"
        )
        self.assertEqual(response.status_code, 403)
