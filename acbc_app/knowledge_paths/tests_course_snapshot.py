"""Exact-byte fixtures for sophia-course-v1 / sophia-credential-v1 hashing."""

from copy import deepcopy

from django.test import SimpleTestCase

from knowledge_paths.course_snapshot import (
    CourseSnapshotError,
    canonical_utf8_bytes,
    hash_course_snapshot,
    hash_credential_artifact,
    jcs_dumps,
    load_json_fixture,
    read_text_fixture,
    sha256_hex_of_canonical_json,
    validate_course_snapshot,
)


class CourseSnapshotHashTests(SimpleTestCase):
    def test_minimal_course_fixture_matches_canonical_bytes_and_digest(self):
        logical = load_json_fixture("minimal.logical.json")
        expected_canonical = read_text_fixture("minimal.canonical.json").rstrip("\n")
        expected_digest = read_text_fixture("minimal.sha256").strip()

        self.assertEqual(jcs_dumps(logical), expected_canonical)
        self.assertEqual(
            canonical_utf8_bytes(logical),
            expected_canonical.encode("utf-8"),
        )
        self.assertEqual(hash_course_snapshot(logical), expected_digest)
        self.assertEqual(sha256_hex_of_canonical_json(logical), expected_digest)

    def test_credential_fixture_matches_canonical_bytes_and_digest(self):
        logical = load_json_fixture("credential.logical.json")
        expected_canonical = read_text_fixture("credential.canonical.json").rstrip("\n")
        expected_digest = read_text_fixture("credential.sha256").strip()
        course_digest = read_text_fixture("minimal.sha256").strip()

        self.assertEqual(logical["courseSnapshotHash"], course_digest)
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
            "courseId": logical["courseId"],
            "completionRequirements": logical["completionRequirements"],
        }
        self.assertEqual(hash_course_snapshot(logical), hash_course_snapshot(reordered))

    def test_title_change_changes_digest(self):
        logical = load_json_fixture("minimal.logical.json")
        mutated = deepcopy(logical)
        mutated["title"] = logical["title"] + " (edited)"
        self.assertNotEqual(
            hash_course_snapshot(logical),
            hash_course_snapshot(mutated),
        )

    def test_node_order_change_changes_digest(self):
        logical = load_json_fixture("minimal.logical.json")
        second = deepcopy(logical["nodes"][0])
        second["nodeId"] = "sophia:node:102"
        second["position"] = 2
        second["title"] = "Second lesson"
        two_nodes = deepcopy(logical)
        two_nodes["nodes"] = [logical["nodes"][0], second]
        swapped = deepcopy(two_nodes)
        swapped["nodes"] = [
            {**second, "position": 1},
            {**logical["nodes"][0], "position": 2, "nodeId": "sophia:node:101"},
        ]
        self.assertNotEqual(
            hash_course_snapshot(two_nodes),
            hash_course_snapshot(swapped),
        )

    def test_assessments_field_is_rejected(self):
        logical = deepcopy(load_json_fixture("minimal.logical.json"))
        logical["nodes"][0]["assessments"] = [{
            "assessmentId": "sophia:quiz:7",
            "version": 1,
        }]
        with self.assertRaises(CourseSnapshotError):
            validate_course_snapshot(logical)

    def test_non_100_passing_score_is_rejected(self):
        logical = deepcopy(load_json_fixture("minimal.logical.json"))
        logical["completionRequirements"]["quizPassingScore"] = 80
        with self.assertRaises(CourseSnapshotError):
            validate_course_snapshot(logical)

    def test_missing_material_blocked_under_strict_policy(self):
        logical = deepcopy(load_json_fixture("minimal.logical.json"))
        logical["nodes"][0]["materials"][0]["coverage"] = "missing"
        logical["nodes"][0]["materials"][0]["uri"] = ""
        with self.assertRaises(CourseSnapshotError):
            validate_course_snapshot(logical, strict_archived=True)

    def test_floats_are_rejected(self):
        with self.assertRaises(CourseSnapshotError):
            jcs_dumps({"version": 1.0})
