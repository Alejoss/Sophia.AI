"""Canonical knowledge-path snapshot hashing (hackathon Phase 1).

See docs/hackathon/knowledge-path-snapshot-schema.md for the frozen schema
contract. This module implements RFC 8785 JCS for the constrained value types
allowed in ``sophia-knowledge-path-v1`` / ``sophia-credential-v1`` documents
(no floats).
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any, Mapping, Sequence

KNOWLEDGE_PATH_SCHEMA_VERSION = "sophia-knowledge-path-v1"
CREDENTIAL_SCHEMA_VERSION = "sophia-credential-v1"
HASH_ALGORITHM = "sha256"
TRANSCRIPT_TEXT_FORMAT = "sophia-normalized-transcript-v1"

ALLOWED_MEDIA_TYPES = frozenset({"VIDEO", "AUDIO", "TEXT", "IMAGE"})
ALLOWED_MATERIAL_TYPES = frozenset({"transcript", "source"})
ALLOWED_COVERAGE = frozenset({"archived", "missing", "skipped"})

_ISO_Z_SECOND = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_KNOWLEDGE_PATH_ID = re.compile(r"^sophia:knowledge-path:\d+$")
_NODE_ID = re.compile(r"^sophia:node:\d+$")
_CONTENT_ID = re.compile(r"^sophia:content:\d+$")
_CREDENTIAL_ID = re.compile(
    r"^sophia:credential:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)
_ETH_ADDRESS = re.compile(r"^0x[0-9a-fA-F]{40}$")


class KnowledgePathSnapshotError(ValueError):
    """Invalid knowledge-path or credential snapshot document."""


def jcs_dumps(value: Any) -> str:
    """Serialize ``value`` with RFC 8785 JSON Canonicalization Scheme.

    Only ``None``, ``bool``, ``int`` (non-bool), ``str``, ``list``/``tuple``,
    and ``dict`` are accepted. Floats are rejected so digests stay portable.
    Object members are emitted in lexicographic order of names by UTF-16
    code units, matching RFC 8785 §3.2.3.
    """
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    if isinstance(value, float):
        raise KnowledgePathSnapshotError(
            "Floats are forbidden in hashed knowledge-path/credential documents"
        )
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return "[" + ",".join(jcs_dumps(item) for item in value) + "]"
    if isinstance(value, Mapping):
        items = sorted(
            value.items(),
            key=lambda item: item[0].encode("utf-16-be"),
        )
        return "{" + ",".join(
            f"{json.dumps(key, ensure_ascii=False)}:{jcs_dumps(val)}"
            for key, val in items
        ) + "}"
    raise KnowledgePathSnapshotError(
        f"Unsupported type for JCS canonicalization: {type(value)!r}"
    )


def sha256_hex_of_canonical_json(document: Mapping[str, Any]) -> str:
    """Return lowercase hex SHA-256 of the JCS canonical UTF-8 bytes."""
    canonical = jcs_dumps(document)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def canonical_utf8_bytes(document: Mapping[str, Any]) -> bytes:
    return jcs_dumps(document).encode("utf-8")


def _require_str(document: Mapping[str, Any], key: str) -> str:
    value = document.get(key)
    if not isinstance(value, str):
        raise KnowledgePathSnapshotError(f"{key} must be a string")
    return value


def _require_int(document: Mapping[str, Any], key: str) -> int:
    value = document.get(key)
    if isinstance(value, bool) or not isinstance(value, int):
        raise KnowledgePathSnapshotError(f"{key} must be an integer")
    return value


def _require_object(document: Mapping[str, Any], key: str) -> Mapping[str, Any]:
    value = document.get(key)
    if not isinstance(value, Mapping):
        raise KnowledgePathSnapshotError(f"{key} must be an object")
    return value


def _require_array(document: Mapping[str, Any], key: str) -> Sequence[Any]:
    value = document.get(key)
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
        raise KnowledgePathSnapshotError(f"{key} must be an array")
    return value


def validate_issuer(issuer: Mapping[str, Any]) -> None:
    unexpected = set(issuer) - {"namespace", "authorUserId", "authorUsername"}
    if unexpected:
        raise KnowledgePathSnapshotError(
            f"issuer has unexpected fields: {sorted(unexpected)}"
        )
    if issuer.get("namespace") != "sophia":
        raise KnowledgePathSnapshotError('issuer.namespace must be "sophia"')
    author_user_id = _require_int(issuer, "authorUserId")
    if author_user_id < 1:
        raise KnowledgePathSnapshotError("issuer.authorUserId must be >= 1")
    if not isinstance(issuer.get("authorUsername"), str):
        raise KnowledgePathSnapshotError("issuer.authorUsername must be a string")


def validate_completion_requirements(requirements: Mapping[str, Any]) -> None:
    expected = {
        "allNodesRequired": True,
        "allNodeQuizzesRequired": True,
        "quizPassingScore": 100,
    }
    if dict(requirements) != expected:
        raise KnowledgePathSnapshotError(
            "completionRequirements must equal "
            f"{expected!r} for sophia-knowledge-path-v1 "
            f"(got {dict(requirements)!r})"
        )


def validate_material(material: Mapping[str, Any], *, strict_archived: bool) -> None:
    unexpected = set(material) - {
        "type",
        "uri",
        "hashAlgorithm",
        "contentHash",
        "textFormat",
        "contentId",
        "coverage",
    }
    if unexpected:
        raise KnowledgePathSnapshotError(
            f"material has unexpected fields: {sorted(unexpected)}"
        )

    material_type = material.get("type")
    if material_type not in ALLOWED_MATERIAL_TYPES:
        raise KnowledgePathSnapshotError(
            f"material.type must be one of {sorted(ALLOWED_MATERIAL_TYPES)}"
        )

    coverage = material.get("coverage")
    if coverage not in ALLOWED_COVERAGE:
        raise KnowledgePathSnapshotError(
            f"material.coverage must be one of {sorted(ALLOWED_COVERAGE)}"
        )

    if material.get("hashAlgorithm") != HASH_ALGORITHM:
        raise KnowledgePathSnapshotError('material.hashAlgorithm must be "sha256"')

    content_hash = _require_str(material, "contentHash")
    if not _HEX64.match(content_hash):
        raise KnowledgePathSnapshotError(
            "material.contentHash must be 64 lowercase hex chars"
        )

    content_id = _require_str(material, "contentId")
    if not _CONTENT_ID.match(content_id):
        raise KnowledgePathSnapshotError(
            "material.contentId must match sophia:content:{id}"
        )

    uri = _require_str(material, "uri")
    if coverage == "archived":
        if not uri.startswith("ipfs://"):
            raise KnowledgePathSnapshotError(
                'material.uri must be an ipfs:// URI when coverage is "archived"'
            )
    elif uri != "":
        raise KnowledgePathSnapshotError(
            'material.uri must be "" when coverage is not "archived"'
        )

    if material_type == "transcript":
        if material.get("textFormat") != TRANSCRIPT_TEXT_FORMAT:
            raise KnowledgePathSnapshotError(
                'transcript materials require textFormat '
                f'"{TRANSCRIPT_TEXT_FORMAT}"'
            )
    elif "textFormat" in material:
        raise KnowledgePathSnapshotError(
            "source materials must not include textFormat"
        )

    if strict_archived and coverage != "archived":
        raise KnowledgePathSnapshotError(
            "strict publication requires every material coverage to be archived"
        )


def validate_node(node: Mapping[str, Any], *, strict_archived: bool) -> None:
    unexpected = set(node) - {
        "nodeId",
        "position",
        "title",
        "description",
        "mediaType",
        "materials",
    }
    if unexpected:
        raise KnowledgePathSnapshotError(
            f"node has unexpected fields: {sorted(unexpected)}"
        )
    if "assessments" in node:
        raise KnowledgePathSnapshotError(
            "assessments are out of hackathon hashing scope; "
            "omit from knowledge-path snapshot"
        )

    node_id = _require_str(node, "nodeId")
    if not _NODE_ID.match(node_id):
        raise KnowledgePathSnapshotError("nodeId must match sophia:node:{id}")

    position = _require_int(node, "position")
    if position < 1:
        raise KnowledgePathSnapshotError("node.position must be >= 1")

    _require_str(node, "title")
    _require_str(node, "description")

    media_type = node.get("mediaType")
    if media_type not in ALLOWED_MEDIA_TYPES:
        raise KnowledgePathSnapshotError(
            f"mediaType must be one of {sorted(ALLOWED_MEDIA_TYPES)}"
        )

    materials = _require_array(node, "materials")
    if not materials:
        raise KnowledgePathSnapshotError(
            "each node must include at least one material"
        )
    for material in materials:
        if not isinstance(material, Mapping):
            raise KnowledgePathSnapshotError("materials entries must be objects")
        validate_material(material, strict_archived=strict_archived)


def validate_knowledge_path_snapshot(
    document: Mapping[str, Any],
    *,
    strict_archived: bool = True,
) -> None:
    """Validate a logical ``sophia-knowledge-path-v1`` document."""
    unexpected = set(document) - {
        "schemaVersion",
        "knowledgePathId",
        "version",
        "title",
        "description",
        "publishedAt",
        "issuer",
        "completionRequirements",
        "nodes",
    }
    if unexpected:
        raise KnowledgePathSnapshotError(
            f"knowledge-path snapshot has unexpected fields: {sorted(unexpected)}"
        )
    if "learningObjectives" in document or "assessments" in document:
        raise KnowledgePathSnapshotError(
            "learningObjectives and top-level assessments are not part of "
            "sophia-knowledge-path-v1"
        )
    if "courseId" in document:
        raise KnowledgePathSnapshotError(
            'use "knowledgePathId", not "courseId"'
        )

    if document.get("schemaVersion") != KNOWLEDGE_PATH_SCHEMA_VERSION:
        raise KnowledgePathSnapshotError(
            f'schemaVersion must be "{KNOWLEDGE_PATH_SCHEMA_VERSION}"'
        )

    knowledge_path_id = _require_str(document, "knowledgePathId")
    if not _KNOWLEDGE_PATH_ID.match(knowledge_path_id):
        raise KnowledgePathSnapshotError(
            "knowledgePathId must match sophia:knowledge-path:{id}"
        )

    version = _require_int(document, "version")
    if version < 1:
        raise KnowledgePathSnapshotError("version must be >= 1")

    _require_str(document, "title")
    _require_str(document, "description")

    published_at = _require_str(document, "publishedAt")
    if not _ISO_Z_SECOND.match(published_at):
        raise KnowledgePathSnapshotError(
            "publishedAt must be UTC second-precision ISO-8601 ending in Z"
        )

    validate_issuer(_require_object(document, "issuer"))
    validate_completion_requirements(
        _require_object(document, "completionRequirements")
    )

    nodes = _require_array(document, "nodes")
    if not nodes:
        raise KnowledgePathSnapshotError("nodes must be a non-empty array")

    seen_positions: set[int] = set()
    for index, node in enumerate(nodes):
        if not isinstance(node, Mapping):
            raise KnowledgePathSnapshotError("nodes entries must be objects")
        validate_node(node, strict_archived=strict_archived)
        position = node["position"]
        if position in seen_positions:
            raise KnowledgePathSnapshotError(
                f"duplicate node.position {position}"
            )
        if position != index + 1:
            raise KnowledgePathSnapshotError(
                "node.position must be the 1-based index in snapshot order "
                f"(expected {index + 1}, got {position})"
            )
        seen_positions.add(position)


def validate_credential_artifact(document: Mapping[str, Any]) -> None:
    unexpected = set(document) - {
        "schemaVersion",
        "credentialId",
        "type",
        "recipient",
        "knowledgePathId",
        "knowledgePathVersion",
        "knowledgePathSnapshotHash",
        "issuedAt",
        "issuer",
    }
    if unexpected:
        raise KnowledgePathSnapshotError(
            f"credential artifact has unexpected fields: {sorted(unexpected)}"
        )
    for legacy_key in ("courseId", "courseVersion", "courseSnapshotHash"):
        if legacy_key in document:
            raise KnowledgePathSnapshotError(
                f'use knowledge-path field names; found legacy "{legacy_key}"'
            )

    if document.get("schemaVersion") != CREDENTIAL_SCHEMA_VERSION:
        raise KnowledgePathSnapshotError(
            f'schemaVersion must be "{CREDENTIAL_SCHEMA_VERSION}"'
        )

    credential_id = _require_str(document, "credentialId")
    if not _CREDENTIAL_ID.match(credential_id):
        raise KnowledgePathSnapshotError(
            "credentialId must match sophia:credential:{uuid}"
        )

    if document.get("type") != "knowledge_path_completion":
        raise KnowledgePathSnapshotError(
            'credential type must be "knowledge_path_completion" for the hackathon demo'
        )

    recipient = _require_str(document, "recipient")
    if not _ETH_ADDRESS.match(recipient):
        raise KnowledgePathSnapshotError(
            "recipient must be a 0x-prefixed 20-byte address"
        )

    knowledge_path_id = _require_str(document, "knowledgePathId")
    if not _KNOWLEDGE_PATH_ID.match(knowledge_path_id):
        raise KnowledgePathSnapshotError(
            "knowledgePathId must match sophia:knowledge-path:{id}"
        )

    knowledge_path_version = _require_int(document, "knowledgePathVersion")
    if knowledge_path_version < 1:
        raise KnowledgePathSnapshotError("knowledgePathVersion must be >= 1")

    snapshot_hash = _require_str(document, "knowledgePathSnapshotHash")
    if not _HEX64.match(snapshot_hash):
        raise KnowledgePathSnapshotError(
            "knowledgePathSnapshotHash must be 64 lowercase hex chars"
        )

    issued_at = _require_str(document, "issuedAt")
    if not _ISO_Z_SECOND.match(issued_at):
        raise KnowledgePathSnapshotError(
            "issuedAt must be UTC second-precision ISO-8601 ending in Z"
        )

    validate_issuer(_require_object(document, "issuer"))


def hash_knowledge_path_snapshot(
    document: Mapping[str, Any],
    *,
    strict_archived: bool = True,
) -> str:
    validate_knowledge_path_snapshot(document, strict_archived=strict_archived)
    return sha256_hex_of_canonical_json(document)


def hash_credential_artifact(document: Mapping[str, Any]) -> str:
    validate_credential_artifact(document)
    return sha256_hex_of_canonical_json(document)


def fixture_dir() -> Path:
    """Path to docs fixtures (repo-relative from this file)."""
    return (
        Path(__file__).resolve().parents[2]
        / "docs"
        / "hackathon"
        / "fixtures"
        / "knowledge-path-snapshot-v1"
    )


def load_json_fixture(name: str) -> Any:
    path = fixture_dir() / name
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def read_text_fixture(name: str) -> str:
    path = fixture_dir() / name
    return path.read_text(encoding="utf-8")
