"""Knowledge-path detail for external workers (Vincent).

Machine-to-machine auth matches transcript/embedding ingest
(``X-Transcript-Ingest-Key`` / ``Authorization: Bearer`` with
``TRANSCRIPT_INGEST_API_KEY``):

* ``GET /api/content/knowledge-path-ingest/<knowledge_path_id>/``
  Ordered nodes with linked content transcript + embedding bookkeeping.
  VIDEO/AUDIO/TEXT all use ``ContentTranscript`` for canonical plain text.
"""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import ContentEmbedding, ContentTranscript
from content.permissions import TranscriptIngestPermission
from content.serializers import KnowledgePathIngestDetailSerializer
from content.transcript_utils import resolve_certified_plain_text
from knowledge_paths.models import KnowledgePath


class KnowledgePathIngestAPIView(APIView):
    """Shared auth for knowledge-path ingest detail (reuses transcript key)."""

    authentication_classes = []
    permission_classes = [TranscriptIngestPermission]


def _node_has_certified_text(content) -> bool:
    if content is None:
        return False
    try:
        transcript = content.transcript
    except ContentTranscript.DoesNotExist:
        return False
    return bool(resolve_certified_plain_text(transcript))


def build_knowledge_path_ingest_detail(knowledge_path: KnowledgePath) -> dict:
    """Assemble Vincent-facing knowledge-path detail payload."""
    nodes = list(
        knowledge_path.nodes.select_related(
            'content_profile__content__transcript',
            'content_profile__content__embedding',
            'content_profile__content__file_details',
            'content_profile__content__uploaded_by',
        )
        .prefetch_related('content_profile__content__topics')
        .order_by('order')
    )

    node_payloads = []
    nodes_with_content = 0
    nodes_with_transcript = 0
    nodes_with_certified_text = 0
    nodes_embedding_indexed = 0

    for index, node in enumerate(nodes):
        profile = node.content_profile
        content = profile.content if profile is not None else None
        has_certified = False

        if content is not None:
            nodes_with_content += 1
            try:
                has_transcript = content.transcript is not None
            except ContentTranscript.DoesNotExist:
                has_transcript = False
            if has_transcript:
                nodes_with_transcript += 1
            has_certified = _node_has_certified_text(content)
            if has_certified:
                nodes_with_certified_text += 1
            try:
                embedding_status = content.embedding.status
            except ContentEmbedding.DoesNotExist:
                embedding_status = None
            if embedding_status == 'indexed':
                nodes_embedding_indexed += 1

        node_payloads.append({
            'id': node.id,
            'node_id': f'sophia-acbc:node:{node.id}',
            'title': node.title or '',
            'description': node.description or '',
            'order': node.order,
            'position': index + 1,
            'media_type': node.media_type or '',
            'content_profile_id': profile.id if profile is not None else None,
            'content': content,
            'has_certified_text': has_certified,
        })

    node_count = len(nodes)
    author = knowledge_path.author
    payload = {
        'id': knowledge_path.id,
        'knowledge_path_id': f'sophia-acbc:knowledge-path:{knowledge_path.id}',
        'title': knowledge_path.title or '',
        'description': knowledge_path.description or '',
        'author_id': author.id if author is not None else None,
        'author_username': author.username if author is not None else '',
        'is_visible': knowledge_path.is_visible,
        'created_at': knowledge_path.created_at,
        'updated_at': knowledge_path.updated_at,
        'nodes': node_payloads,
        'summary': {
            'node_count': node_count,
            'nodes_with_content': nodes_with_content,
            'nodes_with_transcript': nodes_with_transcript,
            'nodes_with_certified_text': nodes_with_certified_text,
            'nodes_embedding_indexed': nodes_embedding_indexed,
            'ready_for_strict_publish': (
                node_count > 0
                and nodes_with_content == node_count
                and nodes_with_certified_text == node_count
            ),
        },
    }
    return KnowledgePathIngestDetailSerializer(payload).data


class KnowledgePathIngestDetailView(KnowledgePathIngestAPIView):
    """
    GET /api/content/knowledge-path-ingest/<knowledge_path_id>/

    Returns the knowledge path with ordered nodes and per-node content
    transcript/embedding state for external workers.
    """

    def get(self, request, knowledge_path_id):
        knowledge_path = get_object_or_404(KnowledgePath, pk=knowledge_path_id)
        return Response(build_knowledge_path_ingest_detail(knowledge_path))
