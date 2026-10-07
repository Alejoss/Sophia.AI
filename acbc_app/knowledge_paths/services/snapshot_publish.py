"""Publish immutable knowledge-path snapshots (admin-triggered)."""

from __future__ import annotations

import json
from datetime import timezone as dt_timezone

from django.db import transaction
from django.utils import timezone as django_timezone

from knowledge_paths.knowledge_path_snapshot import (
    KNOWLEDGE_PATH_SCHEMA_VERSION,
    KnowledgePathSnapshotError,
    hash_knowledge_path_snapshot,
    jcs_dumps,
)
from knowledge_paths.models import KnowledgePath, PublishedKnowledgePathSnapshot
from knowledge_paths.services.snapshot_preview import (
    build_knowledge_path_snapshot_document,
)


class SnapshotPublishError(ValueError):
    """Snapshot could not be published."""


@transaction.atomic
def publish_knowledge_path_snapshot(
    knowledge_path: KnowledgePath,
    *,
    published_by,
) -> tuple[PublishedKnowledgePathSnapshot, bool]:
    """Build a complete snapshot from live path data and persist it immutably.

    Returns the snapshot and whether a new version row was stored. A new version
    is stored only when the curriculum digest differs from the latest snapshot.
    ``version`` and ``publishedAt`` are part of the hashed document, so the
    comparison reuses the latest snapshot's version and timestamp. A repeat
    publish of the same curriculum keeps that snapshot.

    Raises ``SnapshotPublishError`` when the path is incomplete for certification
    (e.g. missing embedded transcript text).
    """
    if published_by is None or not getattr(published_by, "is_staff", False):
        raise SnapshotPublishError("Only staff may publish knowledge-path snapshots")

    latest = (
        PublishedKnowledgePathSnapshot.objects.filter(knowledge_path=knowledge_path)
        .order_by("-version")
        .first()
    )
    if latest is not None and _same_curriculum(knowledge_path, latest):
        return latest, False

    version = (latest.version if latest is not None else 0) + 1
    document, issues = build_knowledge_path_snapshot_document(
        knowledge_path,
        version=version,
    )
    digest, canonical = _digest_or_raise(document, issues)

    snapshot = PublishedKnowledgePathSnapshot.objects.create(
        knowledge_path=knowledge_path,
        version=version,
        schema_version=KNOWLEDGE_PATH_SCHEMA_VERSION,
        document_text=canonical,
        digest=digest,
        published_by=published_by,
    )
    return snapshot, True


def _same_curriculum(
    knowledge_path: KnowledgePath,
    latest: PublishedKnowledgePathSnapshot,
) -> bool:
    """True when live content hashes to the latest snapshot's stored digest."""
    try:
        stored = json.loads(latest.document_text)
    except json.JSONDecodeError as exc:
        raise SnapshotPublishError("Stored snapshot document is not valid JSON") from exc

    document, issues = build_knowledge_path_snapshot_document(
        knowledge_path,
        version=int(stored["version"]),
        published_at=stored["publishedAt"],
    )
    digest, _canonical = _digest_or_raise(document, issues)
    return digest == latest.digest


def _digest_or_raise(document: dict, issues: list) -> tuple[str, str]:
    try:
        digest = hash_knowledge_path_snapshot(document, require_complete=True)
    except KnowledgePathSnapshotError as exc:
        codes = [issue.get("code") for issue in issues if issue.get("code")]
        detail = str(exc)
        if codes:
            detail = f"{detail} Issues: {', '.join(codes)}"
        raise SnapshotPublishError(detail) from exc
    return digest, jcs_dumps(document)


def serialize_published_snapshot(snapshot: PublishedKnowledgePathSnapshot) -> dict:
    published_at = snapshot.published_at
    if published_at is not None:
        if django_timezone.is_naive(published_at):
            published_at = published_at.replace(tzinfo=dt_timezone.utc)
        else:
            published_at = published_at.astimezone(dt_timezone.utc)
        published_at_str = published_at.replace(microsecond=0).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
    else:
        published_at_str = None

    from knowledge_paths.services.snapshot_anchor import blockchain_payload_for_snapshot

    return {
        "id": snapshot.id,
        "knowledgePathId": f"sophia-acbc:knowledge-path:{snapshot.knowledge_path_id}",
        "knowledgePathDbId": snapshot.knowledge_path_id,
        "knowledgePathTitle": snapshot.knowledge_path.title,
        "version": snapshot.version,
        "schemaVersion": snapshot.schema_version,
        "digest": snapshot.digest,
        "publishedAt": published_at_str,
        "publishedBy": {
            "id": snapshot.published_by_id,
            "username": snapshot.published_by.username,
        },
        "document": snapshot.document,
        "canonical": snapshot.document_text,
        "blockchain": blockchain_payload_for_snapshot(snapshot),
    }
