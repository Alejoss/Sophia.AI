"""Build live knowledge-path snapshot previews for author testing.

Preview documents follow ``sophia-knowledge-path-v1`` but may use
``coverage: "missing"`` until IPFS archival exists. Transcripts are preferred
for VIDEO/AUDIO; ``source`` materials are allowed when no transcript exists.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from django.utils import timezone as django_timezone

from knowledge_paths.knowledge_path_snapshot import (
    KnowledgePathSnapshotError,
    TRANSCRIPT_TEXT_FORMAT,
    HASH_ALGORITHM,
    hash_knowledge_path_snapshot,
    jcs_dumps,
    validate_knowledge_path_snapshot,
)
from knowledge_paths.models import KnowledgePath, Node


def _utc_now_second() -> str:
    now = django_timezone.now()
    if django_timezone.is_naive(now):
        now = now.replace(tzinfo=timezone.utc)
    else:
        now = now.astimezone(timezone.utc)
    return now.replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def _node_material(node: Node) -> tuple[dict[str, Any], list[dict[str, str]]]:
    """Return (material object, issues).

    Unknown IPFS URI and unknown content hash are empty strings — never invented
    placeholder digests.
    """
    issues: list[dict[str, str]] = []
    profile = node.content_profile
    if profile is None or profile.content_id is None:
        issues.append({
            "code": "NO_CONTENT",
            "nodeId": f"sophia:node:{node.id}",
            "message": (
                "Node has no linked content. Attach content before a strict "
                "certified publish."
            ),
        })
        return {
            "type": "source",
            "uri": "",
            "hashAlgorithm": HASH_ALGORITHM,
            "contentHash": "",
            "contentId": "",
            "coverage": "missing",
        }, issues

    content = profile.content
    content_id = f"sophia:content:{content.id}"
    transcript = getattr(content, "transcript", None)
    text_hash = (getattr(transcript, "text_hash", None) or "").strip().lower()

    if text_hash and len(text_hash) == 64:
        issues.append({
            "code": "IPFS_URI_PENDING",
            "nodeId": f"sophia:node:{node.id}",
            "message": (
                "Transcript hash is known, but there is no IPFS URI yet. "
                "uri stays \"\" and coverage stays missing until pinned."
            ),
        })
        return {
            "type": "transcript",
            "uri": "",
            "hashAlgorithm": HASH_ALGORITHM,
            "contentHash": text_hash,
            "textFormat": TRANSCRIPT_TEXT_FORMAT,
            "contentId": content_id,
            "coverage": "missing",
        }, issues

    # No transcript hash yet: leave contentHash empty; still allow snapshot preview.
    issues.append({
        "code": "NO_CONTENT_HASH",
        "nodeId": f"sophia:node:{node.id}",
        "message": (
            "No transcript/source contentHash yet. contentHash is \"\". "
            "Strict publish needs archived bytes (transcript or source) with a "
            "real SHA-256 and an ipfs:// URI."
        ),
    })
    return {
        "type": "source",
        "uri": "",
        "hashAlgorithm": HASH_ALGORITHM,
        "contentHash": "",
        "contentId": content_id,
        "coverage": "missing",
    }, issues


def build_knowledge_path_snapshot_document(
    knowledge_path: KnowledgePath,
    *,
    version: int = 1,
    published_at: str | None = None,
) -> tuple[dict[str, Any], list[dict[str, str]]]:
    """Build a logical snapshot document from the live editable path."""
    issues: list[dict[str, str]] = []
    author = knowledge_path.author
    if author is None:
        issues.append({
            "code": "NO_AUTHOR",
            "nodeId": "",
            "message": "Knowledge path has no author; issuer fields are incomplete.",
        })
        author_user_id = 0
        author_username = ""
    else:
        author_user_id = author.id
        author_username = author.username

    nodes = list(
        knowledge_path.nodes.select_related(
            "content_profile__content__transcript",
        ).order_by("order")
    )
    if not nodes:
        issues.append({
            "code": "NO_NODES",
            "nodeId": "",
            "message": "Knowledge path has no nodes.",
        })

    snapshot_nodes = []
    for index, node in enumerate(nodes):
        material, material_issues = _node_material(node)
        issues.extend(material_issues)
        snapshot_nodes.append({
            "nodeId": f"sophia:node:{node.id}",
            "position": index + 1,
            "title": node.title or "",
            "description": node.description or "",
            "mediaType": node.media_type or "TEXT",
            "materials": [material],
        })

    document = {
        "schemaVersion": "sophia-knowledge-path-v1",
        "knowledgePathId": f"sophia:knowledge-path:{knowledge_path.id}",
        "version": version,
        "title": knowledge_path.title or "",
        "description": knowledge_path.description or "",
        "publishedAt": published_at or _utc_now_second(),
        "issuer": {
            "namespace": "sophia",
            "authorUserId": max(author_user_id, 1) if author_user_id else 1,
            "authorUsername": author_username or "unknown",
        },
        "completionRequirements": {
            "allNodesRequired": True,
            "allNodeQuizzesRequired": True,
            "quizPassingScore": 100,
        },
        "nodes": snapshot_nodes,
    }

    if author_user_id < 1:
        # Keep document shape valid for hashing demos; flag the issue above.
        pass

    return document, issues


def preview_knowledge_path_snapshot(
    knowledge_path: KnowledgePath,
    *,
    version: int = 1,
) -> dict[str, Any]:
    """Return document, optional digest, and publish readiness for the dashboard."""
    document, issues = build_knowledge_path_snapshot_document(
        knowledge_path,
        version=version,
    )

    valid_for_hash = False
    digest = None
    canonical = None
    validation_error = None
    try:
        validate_knowledge_path_snapshot(document, strict_archived=False)
        canonical = jcs_dumps(document)
        digest = hash_knowledge_path_snapshot(document, strict_archived=False)
        valid_for_hash = True
    except KnowledgePathSnapshotError as exc:
        validation_error = str(exc)

    ready_for_strict_publish = False
    if valid_for_hash:
        try:
            validate_knowledge_path_snapshot(document, strict_archived=True)
            ready_for_strict_publish = True
        except KnowledgePathSnapshotError:
            ready_for_strict_publish = False

    return {
        "schemaVersion": "sophia-knowledge-path-v1",
        "knowledgePathId": f"sophia:knowledge-path:{knowledge_path.id}",
        "version": version,
        "document": document,
        "canonical": canonical,
        "digest": digest,
        "validForHash": valid_for_hash,
        "readyForStrictPublish": ready_for_strict_publish,
        "issues": issues,
        "validationError": validation_error,
        "notes": {
            "hashedBytes": (
                "The digest is SHA-256 of the RFC 8785 JCS canonical JSON "
                "(UTF-8), not of the pretty-printed document."
            ),
            "transcripts": (
                "Transcripts are preferred for VIDEO/AUDIO and must match Bitcoin "
                "text_hash when used. Snapshots may instead use source materials "
                "when no transcript exists."
            ),
            "ipfs": (
                "Preview sets coverage=missing and uri=\"\" until exact bytes are "
                "pinned. Filling uri and setting coverage=archived changes the digest."
            ),
        },
    }
