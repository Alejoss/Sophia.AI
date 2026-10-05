"""Exact-byte fixtures for sophia-acbc-knowledge-path-v1 / sophia-acbc-credential-v1 hashing."""

from copy import deepcopy

from django.test import SimpleTestCase

from knowledge_paths.knowledge_path_snapshot import (
    KnowledgePathSnapshotError,
    canonical_utf8_bytes,
    hash_credential_artifact,
    hash_knowledge_path_snapshot,
    jcs_dumps,
    load_json_fixture,
    read_text_fixture,
    sha256_hex_of_canonical_json,
    transcript_text_sha256,
    validate_knowledge_path_snapshot,
)


class KnowledgePathSnapshotHashTests(SimpleTestCase):
    def test_minimal_knowledge_path_fixture_matches_canonical_bytes_and_digest(self):
        logical = load_json_fixture("minimal.logical.json")
        expected_canonical = read_text_fixture("minimal.canonical.json").rstrip("\n")
        expected_digest = read_text_fixture("minimal.sha256").strip()

        self.assertEqual(jcs_dumps(logical), expected_canonical)
        self.assertEqual(
            canonical_utf8_bytes(logical),
            expected_canonical.encode("utf-8"),
        )
        self.assertEqual(hash_knowledge_path_snapshot(logical), expected_digest)
        self.assertEqual(sha256_hex_of_canonical_json(logical), expected_digest)

    def test_embedded_transcript_text_sha256_is_reconstructible(self):
        logical = load_json_fixture("minimal.logical.json")
        text = logical["nodes"][0]["materials"][0]["text"]
        self.assertEqual(
            transcript_text_sha256(text),
            read_text_fixture("minimal.transcript-text.sha256").strip(),
        )

    def test_credential_fixture_matches_canonical_bytes_and_digest(self):
        logical = load_json_fixture("credential.logical.json")
        expected_canonical = read_text_fixture("credential.canonical.json").rstrip("\n")
        expected_digest = read_text_fixture("credential.sha256").strip()
        path_digest = read_text_fixture("minimal.sha256").strip()

        self.assertEqual(logical["knowledgePathSnapshotHash"], path_digest)
        self.assertEqual(jcs_dumps(logical), expected_canonical)
        self.assertEqual(hash_credential_artifact(logical), expected_digest)

    def test_object_key_order_does_not_change_digest(self):
        logical = load_json_fixture("minimal.logical.json")
        reordered = {
            "nodes": logical["nodes"],
            "version": logical["version"],
            "title": logical["title"],
            "schemaVersion": logical["schemaVersion"],
            "publishedAt": logical["publishedAt"],
            "issuer": logical["issuer"],
            "description": logical["description"],
            "knowledgePathId": logical["knowledgePathId"],
            "completionRequirements": logical["completionRequirements"],
        }
        self.assertEqual(
            hash_knowledge_path_snapshot(logical),
            hash_knowledge_path_snapshot(reordered),
        )

    def test_title_change_changes_digest(self):
        logical = load_json_fixture("minimal.logical.json")
        mutated = deepcopy(logical)
        mutated["title"] = logical["title"] + " (edited)"
        self.assertNotEqual(
            hash_knowledge_path_snapshot(logical),
            hash_knowledge_path_snapshot(mutated),
        )

    def test_transcript_text_change_changes_digest(self):
        logical = load_json_fixture("minimal.logical.json")
        mutated = deepcopy(logical)
        mutated["nodes"][0]["materials"][0]["text"] = (
            logical["nodes"][0]["materials"][0]["text"] + " edited"
        )
        self.assertNotEqual(
            hash_knowledge_path_snapshot(logical),
            hash_knowledge_path_snapshot(mutated),
        )

    def test_node_order_change_changes_digest(self):
        logical = load_json_fixture("minimal.logical.json")
        second = deepcopy(logical["nodes"][0])
        second["nodeId"] = "sophia-acbc:node:102"
        second["position"] = 2
        second["title"] = "Second lesson"
        two_nodes = deepcopy(logical)
        two_nodes["nodes"] = [logical["nodes"][0], second]
        swapped = deepcopy(two_nodes)
        swapped["nodes"] = [
            {**second, "position": 1},
            {**logical["nodes"][0], "position": 2, "nodeId": "sophia-acbc:node:101"},
        ]
        self.assertNotEqual(
            hash_knowledge_path_snapshot(two_nodes),
            hash_knowledge_path_snapshot(swapped),
        )

    def test_assessments_field_is_rejected(self):
        logical = deepcopy(load_json_fixture("minimal.logical.json"))
        logical["nodes"][0]["assessments"] = [{
            "assessmentId": "sophia-acbc:quiz:7",
            "version": 1,
        }]
        with self.assertRaises(KnowledgePathSnapshotError):
            validate_knowledge_path_snapshot(logical)

    def test_legacy_course_id_field_is_rejected(self):
        logical = deepcopy(load_json_fixture("minimal.logical.json"))
        logical["courseId"] = logical.pop("knowledgePathId")
        with self.assertRaises(KnowledgePathSnapshotError):
            validate_knowledge_path_snapshot(logical)

    def test_uri_and_content_hash_fields_are_rejected(self):
        logical = deepcopy(load_json_fixture("minimal.logical.json"))
        logical["nodes"][0]["materials"][0]["uri"] = "ipfs://abc"
        with self.assertRaises(KnowledgePathSnapshotError):
            validate_knowledge_path_snapshot(logical, require_complete=False)

    def test_non_100_passing_score_is_rejected(self):
        logical = deepcopy(load_json_fixture("minimal.logical.json"))
        logical["completionRequirements"]["quizPassingScore"] = 80
        with self.assertRaises(KnowledgePathSnapshotError):
            validate_knowledge_path_snapshot(logical)

    def test_empty_text_blocked_under_strict_policy(self):
        logical = deepcopy(load_json_fixture("minimal.logical.json"))
        logical["nodes"][0]["materials"][0]["text"] = ""
        validate_knowledge_path_snapshot(logical, require_complete=False)
        with self.assertRaises(KnowledgePathSnapshotError):
            validate_knowledge_path_snapshot(logical, require_complete=True)

    def test_floats_are_rejected(self):
        with self.assertRaises(KnowledgePathSnapshotError):
            jcs_dumps({"version": 1.0})
