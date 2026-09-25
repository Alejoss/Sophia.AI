"""Build live knowledge-path snapshot previews for author testing.

Preview documents follow ``sophia-acbc-knowledge-path-v1``. Materials embed exact
normalized transcript ``text`` (no IPFS URI / contentHash). Completeness means
non-empty embedded text.
"""

from __future__ import annotations

from datetime import timezone
from typing import Any

from django.utils import timezone as django_timezone

from content.transcript_utils import resolve_certified_plain_text
from knowledge_paths.knowledge_path_snapshot import (
    KnowledgePathSnapshotError,
    TRANSCRIPT_TEXT_FORMAT,
    hash_knowledge_path_snapshot,
    jcs_dumps,
    material_is_complete,
    transcript_text_sha256,
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


def _node_issue(node: Node, *, code: str, message: str) -> dict[str, str]:
    """Build a preview issue that names the node for authors/admins."""
    return {
        "code": code,
        "nodeId": f"sophia-acbc:node:{node.id}",
        "nodeTitle": (node.title or "").strip(),
        "message": message,
    }


def _node_material(node: Node) -> tuple[dict[str, Any], list[dict[str, str]]]:
    """Return (material object, issues)."""
    issues: list[dict[str, str]] = []
    profile = node.content_profile
    if profile is None or profile.content_id is None:
        issues.append(_node_issue(
            node,
            code="NO_CONTENT",
            message=(
                "Node has no linked content. Attach content before a strict "
                "certified publish."
            ),
        ))
        return {
            "type": "source",
            "text": "",
            "contentId": "",
        }, issues

    content = profile.content
    content_id = f"sophia-acbc:content:{content.id}"
    transcript = getattr(content, "transcript", None)

    if transcript is not None:
        text = resolve_certified_plain_text(transcript) or ""
        if text:
            return {
                "type": "transcript",
                "textFormat": TRANSCRIPT_TEXT_FORMAT,
                "text": text,
                "contentId": content_id,
            }, issues
        issues.append(_node_issue(
            node,
            code="EMPTY_TRANSCRIPT",
            message=(
                "Transcript exists but normalized text is empty. "
                "text stays \"\" until ingest provides certified plain text."
            ),
        ))
        return {
            "type": "transcript",
            "textFormat": TRANSCRIPT_TEXT_FORMAT,
            "text": "",
            "contentId": content_id,
        }, issues

    issues.append(_node_issue(
        node,
        code="NO_TRANSCRIPT_TEXT",
        message=(
            "No transcript text to embed. Strict publish needs the exact "
            "normalized plain text in the material."
        ),
    ))
    return {
        "type": "source",
        "text": "",
        "contentId": content_id,
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
            "nodeTitle": "",
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
            "nodeTitle": "",
            "message": "Knowledge path has no nodes.",
        })

    snapshot_nodes = []
    for index, node in enumerate(nodes):
        material, material_issues = _node_material(node)
        issues.extend(material_issues)
        snapshot_nodes.append({
            "nodeId": f"sophia-acbc:node:{node.id}",
            "position": index + 1,
            "title": node.title or "",
            "description": node.description or "",
            "mediaType": node.media_type or "TEXT",
            "materials": [material],
        })

    document = {
        "schemaVersion": "sophia-acbc-knowledge-path-v1",
        "knowledgePathId": f"sophia-acbc:knowledge-path:{knowledge_path.id}",
        "version": version,
        "title": knowledge_path.title or "",
        "description": knowledge_path.description or "",
        "publishedAt": published_at or _utc_now_second(),
        "issuer": {
            "namespace": "sophia-acbc",
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
        validate_knowledge_path_snapshot(document, require_complete=False)
        canonical = jcs_dumps(document)
        digest = hash_knowledge_path_snapshot(document, require_complete=False)
        valid_for_hash = True
    except KnowledgePathSnapshotError as exc:
        validation_error = str(exc)

    ready_for_strict_publish = False
    if valid_for_hash:
        try:
            validate_knowledge_path_snapshot(document, require_complete=True)
            ready_for_strict_publish = True
        except KnowledgePathSnapshotError:
            ready_for_strict_publish = False

    material_digests = []
    for node in document.get("nodes", []):
        for material in node.get("materials", []):
            text = material.get("text") or ""
            material_digests.append({
                "nodeId": node.get("nodeId"),
                "nodeTitle": node.get("title") or "",
                "contentId": material.get("contentId"),
                "complete": material_is_complete(material),
                "textSha256": transcript_text_sha256(text) if text else "",
            })

    return {
        "schemaVersion": "sophia-acbc-knowledge-path-v1",
        "knowledgePathId": f"sophia-acbc:knowledge-path:{knowledge_path.id}",
        "version": version,
        "document": document,
        "canonical": canonical,
        "digest": digest,
        "validForHash": valid_for_hash,
        "readyForStrictPublish": ready_for_strict_publish,
        "materialDigests": material_digests,
        "issues": issues,
        "validationError": validation_error,
        "notes": {
            "hashedBytes": (
                "The knowledge-path digest is SHA-256 of the RFC 8785 JCS "
                "canonical JSON (UTF-8), which includes embedded material text."
            ),
            "transcriptVerification": (
                "Given material.text and textFormat sophia-acbc-normalized-transcript-v1, "
                "SHA-256(UTF-8 text) matches Bitcoin TranscriptAnchor.text_hash. "
                "IPFS is not part of this snapshot."
            ),
        },
    }


def knowledge_path_snapshot_readiness(knowledge_path: KnowledgePath) -> dict[str, Any]:
    """Compact readiness payload for authors/staff (no full document body).

    Use this for dashboards and API clients that need publish state without the
    heavy JCS document returned by ``preview_knowledge_path_snapshot``.
    """
    from knowledge_paths.models import PublishedKnowledgePathSnapshot
    from knowledge_paths.services.snapshot_publish import serialize_published_snapshot

    preview = preview_knowledge_path_snapshot(knowledge_path, version=1)
    document = preview.get("document") or {}
    material_by_node = {
        item.get("nodeId"): item for item in (preview.get("materialDigests") or [])
    }

    nodes_out: list[dict[str, Any]] = []
    for node in document.get("nodes") or []:
        node_id = node.get("nodeId") or ""
        material = (node.get("materials") or [{}])[0]
        material_meta = material_by_node.get(node_id) or {}
        nodes_out.append({
            "nodeId": node_id,
            "nodeTitle": node.get("title") or "",
            "position": node.get("position"),
            "mediaType": node.get("mediaType") or "",
            "contentId": material.get("contentId") or "",
            "materialType": material.get("type") or "",
            "hasCertifiedText": bool(material_meta.get("complete")),
            "textSha256": material_meta.get("textSha256") or "",
        })

    published_qs = (
        PublishedKnowledgePathSnapshot.objects.filter(knowledge_path=knowledge_path)
        .select_related("published_by")
        .order_by("-version")
    )
    published_count = published_qs.count()
    latest = published_qs.first()
    latest_payload = None
    if latest is not None:
        serialized = serialize_published_snapshot(latest)
        latest_payload = {
            "version": serialized["version"],
            "digest": serialized["digest"],
            "schemaVersion": serialized["schemaVersion"],
            "publishedAt": serialized["publishedAt"],
            "publishedBy": serialized["publishedBy"],
        }

    return {
        "knowledgePathDbId": knowledge_path.id,
        "knowledgePathId": f"sophia-acbc:knowledge-path:{knowledge_path.id}",
        "title": knowledge_path.title or "",
        "description": knowledge_path.description or "",
        "authorId": knowledge_path.author_id,
        "authorUsername": (
            knowledge_path.author.username if knowledge_path.author_id else ""
        ),
        "isVisible": knowledge_path.is_visible,
        "validForHash": preview["validForHash"],
        "readyForStrictPublish": preview["readyForStrictPublish"],
        "liveDigest": preview.get("digest"),
        "validationError": preview.get("validationError"),
        "issues": preview.get("issues") or [],
        "nodes": nodes_out,
        "summary": {
            "nodeCount": len(nodes_out),
            "nodesWithCertifiedText": sum(
                1 for node in nodes_out if node["hasCertifiedText"]
            ),
            "issueCount": len(preview.get("issues") or []),
            "publishedSnapshotCount": published_count,
        },
        "published": {
            "count": published_count,
            "latest": latest_payload,
        },
        "blockchain": {
            "status": "not_implemented",
            "network": None,
            "txid": None,
            "message": (
                "Knowledge-path snapshot Bitcoin broadcast is not wired yet. "
                "Admin can persist snapshots in Postgres; on-chain anchoring is next."
            ),
        },
    }
