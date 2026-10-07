"""Tests for admin-published knowledge-path snapshots."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from content.models import Content, ContentProfile, ContentTranscript
from knowledge_paths.models import KnowledgePath, Node, PublishedKnowledgePathSnapshot
from knowledge_paths.services.snapshot_publish import (
    SnapshotPublishError,
    publish_knowledge_path_snapshot,
)


class SnapshotPublishServiceTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin",
            password="pass",
            is_staff=True,
        )
        self.author = User.objects.create_user(username="author", password="pass")
        self.path = KnowledgePath.objects.create(
            title="Introduction to Bitcoin",
            description="Desc",
            author=self.author,
        )
        self.content = Content.objects.create(
            media_type="VIDEO",
            original_title="Lesson",
            uploaded_by=self.author,
        )
        ContentTranscript.objects.create(
            content=self.content,
            processed_plain="Bitcoin is digital money.",
        )
        profile = ContentProfile.objects.create(
            content=self.content,
            user=self.author,
            title="Lesson",
        )
        Node.objects.create(
            knowledge_path=self.path,
            content_profile=profile,
            title="Lesson",
            description="Node desc",
            order=1,
            media_type="VIDEO",
        )

    def test_publish_persists_canonical_text_and_digest(self):
        snapshot, created = publish_knowledge_path_snapshot(
            self.path,
            published_by=self.admin,
        )
        self.assertTrue(created)
        self.assertEqual(snapshot.version, 1)
        self.assertEqual(len(snapshot.digest), 64)
        self.assertTrue(snapshot.document_text.startswith("{"))
        self.assertIn("Bitcoin is digital money.", snapshot.document_text)
        self.assertEqual(snapshot.published_by_id, self.admin.id)
        self.assertEqual(snapshot.document["version"], 1)

        second, second_created = publish_knowledge_path_snapshot(
            self.path,
            published_by=self.admin,
        )
        self.assertFalse(second_created)
        self.assertEqual(second.id, snapshot.id)
        self.assertEqual(second.version, 1)
        self.assertEqual(
            PublishedKnowledgePathSnapshot.objects.filter(knowledge_path=self.path).count(),
            1,
        )

    def test_publish_new_version_only_when_digest_changes(self):
        first, _created = publish_knowledge_path_snapshot(
            self.path,
            published_by=self.admin,
        )
        self.path.title = "Introduction to Bitcoin, revised"
        self.path.save(update_fields=["title"])

        second, created = publish_knowledge_path_snapshot(
            self.path,
            published_by=self.admin,
        )
        self.assertTrue(created)
        self.assertEqual(second.version, 2)
        self.assertNotEqual(second.digest, first.digest)
        self.assertEqual(second.document["version"], 2)
        self.assertEqual(
            PublishedKnowledgePathSnapshot.objects.filter(knowledge_path=self.path).count(),
            2,
        )

    def test_publish_rejects_incomplete_path(self):
        ContentTranscript.objects.filter(content=self.content).delete()
        with self.assertRaises(SnapshotPublishError):
            publish_knowledge_path_snapshot(self.path, published_by=self.admin)[0]

    def test_publish_rejects_non_staff(self):
        with self.assertRaises(SnapshotPublishError):
            publish_knowledge_path_snapshot(self.path, published_by=self.author)[0]

    def test_snapshot_row_is_immutable(self):
        snapshot, _created = publish_knowledge_path_snapshot(
            self.path,
            published_by=self.admin,
        )
        snapshot.digest = "b" * 64
        with self.assertRaises(ValueError):
            snapshot.save()


class SnapshotPublishAPITests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin",
            password="pass",
            is_staff=True,
        )
        self.author = User.objects.create_user(username="author", password="pass")
        self.path = KnowledgePath.objects.create(
            title="Path",
            description="",
            author=self.author,
        )
        content = Content.objects.create(
            media_type="VIDEO",
            original_title="L",
            uploaded_by=self.author,
        )
        ContentTranscript.objects.create(
            content=content,
            processed_plain="Hello world transcript.",
        )
        profile = ContentProfile.objects.create(
            content=content,
            user=self.author,
            title="L",
        )
        Node.objects.create(
            knowledge_path=self.path,
            content_profile=profile,
            title="L",
            description="",
            order=1,
            media_type="VIDEO",
        )
        self.client = APIClient()

    def test_admin_can_publish_and_fetch(self):
        self.client.force_authenticate(user=self.admin)
        create = self.client.post(f"/api/knowledge_paths/{self.path.id}/snapshots/")
        self.assertEqual(create.status_code, 201, create.data)
        self.assertEqual(create.data["version"], 1)
        self.assertTrue(create.data["created"])
        self.assertEqual(len(create.data["digest"]), 64)
        self.assertIn("document", create.data)

        again = self.client.post(f"/api/knowledge_paths/{self.path.id}/snapshots/")
        self.assertEqual(again.status_code, 200, again.data)
        self.assertFalse(again.data["created"])
        self.assertEqual(again.data["version"], 1)
        self.assertEqual(again.data["digest"], create.data["digest"])

        listing = self.client.get(f"/api/knowledge_paths/{self.path.id}/snapshots/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.data["snapshots"]), 1)

        detail = self.client.get(
            f"/api/knowledge_paths/{self.path.id}/snapshots/1/"
        )
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["digest"], create.data["digest"])

        dashboard = self.client.get("/api/knowledge_paths/admin/snapshots/")
        self.assertEqual(dashboard.status_code, 200)
        match = next(item for item in dashboard.data["paths"] if item["id"] == self.path.id)
        self.assertEqual(match["latestSnapshot"]["version"], 1)

    def test_non_admin_forbidden(self):
        self.client.force_authenticate(user=self.author)
        response = self.client.post(f"/api/knowledge_paths/{self.path.id}/snapshots/")
        self.assertEqual(response.status_code, 403)
