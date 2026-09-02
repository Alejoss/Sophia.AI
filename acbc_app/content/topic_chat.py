"""Topic RAG chat: retrieve Qdrant chunks + ask OpenAI with strict grounding."""

from __future__ import annotations

import logging
from typing import Any, Optional

import requests
from django.conf import settings

from django.db.models import Exists, OuterRef

from content.models import Content, ContentTranscript
from utils.openai_client import OpenAIClient, OpenAIClientError, openai_configured
from utils.qdrant_client import QdrantClient, QdrantClientError, qdrant_configured

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    'Eres un asistente de Academia Blockchain. Respondes preguntas sobre un tema '
    'usando ÚNICAMENTE los fragmentos de transcripciones proporcionados como contexto.\n'
    'Reglas:\n'
    '- Si el contexto no contiene la información, di claramente que no la encuentras '
    'en las transcripciones del tema. No inventes.\n'
    '- Cita fuentes con [n] donde n es el número del fragmento.\n'
    '- Responde en español, de forma clara y educativa.\n'
    '- No inventes citas, títulos ni hechos fuera del contexto.'
)


class TopicChatError(RuntimeError):
    """Raised for configuration / upstream failures in topic chat."""

    def __init__(self, message: str, *, status_code: int = 503):
        super().__init__(message)
        self.status_code = status_code


def topic_chat_ready() -> tuple[bool, str]:
    if not openai_configured():
        return False, 'OPENAI_API_KEY no está configurada.'
    if not qdrant_configured():
        return False, 'QDRANT_URL / QDRANT_API_KEY no están configuradas.'
    return True, ''


def _top_k() -> int:
    try:
        return max(1, min(int(getattr(settings, 'TOPIC_CHAT_TOP_K', 8)), 32))
    except (TypeError, ValueError):
        return 8


def _max_context_chars() -> int:
    try:
        return max(1000, int(getattr(settings, 'TOPIC_CHAT_MAX_CONTEXT_CHARS', 12000)))
    except (TypeError, ValueError):
        return 12000


def _score_of(hit: dict[str, Any]) -> float:
    try:
        return float(hit.get('score') or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _dedupe_hits(hits: list[dict[str, Any]], *, max_per_content: int = 2) -> list[dict[str, Any]]:
    """Keep highest-scoring hits; limit how many chunks come from the same content."""
    ordered = sorted(hits, key=_score_of, reverse=True)
    per_content: dict[Any, int] = {}
    selected: list[dict[str, Any]] = []
    for hit in ordered:
        payload = hit.get('payload') or {}
        content_id = payload.get('content_id')
        key = content_id if content_id is not None else id(hit)
        count = per_content.get(key, 0)
        if count >= max_per_content:
            continue
        per_content[key] = count + 1
        selected.append(hit)
    return selected


def _load_content_meta(content_ids: list[int]) -> dict[int, dict[str, Any]]:
    if not content_ids:
        return {}
    transcript_exists = ContentTranscript.objects.filter(content_id=OuterRef('pk'))
    rows = (
        Content.objects.filter(pk__in=content_ids)
        .annotate(has_transcript=Exists(transcript_exists))
        .values_list('id', 'original_title', 'media_type', 'has_transcript')
    )
    return {
        pk: {
            'title': title or '',
            'media_type': media_type or '',
            'has_transcript': bool(has_transcript),
        }
        for pk, title, media_type, has_transcript in rows
    }


def _source_urls(
    *,
    content_id: int,
    topic_id: Optional[int],
    has_transcript: bool,
) -> tuple[Optional[str], Optional[str]]:
    """Return (source_url, transcript_url) for a citation.

    Video/audio with a stored transcript keep the transcript page.
    Text/PDF (and anything without a transcript) go to the topic content view.
    """
    if has_transcript:
        transcript_url = f'/content/{content_id}/transcript?context=topic'
        source_url = (
            f'{transcript_url}&topicId={topic_id}'
            if topic_id is not None
            else transcript_url
        )
        return source_url, transcript_url
    if topic_id is not None:
        return f'/content/{content_id}/topic/{topic_id}', None
    return f'/content/{content_id}/library', None


def build_sources_from_hits(
    hits: list[dict[str, Any]],
    *,
    topic_id: Optional[int] = None,
) -> list[dict[str, Any]]:
    content_ids = []
    for hit in hits:
        payload = hit.get('payload') or {}
        cid = payload.get('content_id')
        if cid is not None:
            try:
                content_ids.append(int(cid))
            except (TypeError, ValueError):
                pass
    meta = _load_content_meta(list(dict.fromkeys(content_ids)))

    sources: list[dict[str, Any]] = []
    for index, hit in enumerate(hits, start=1):
        payload = hit.get('payload') or {}
        content_id = payload.get('content_id')
        try:
            content_id_int = int(content_id) if content_id is not None else None
        except (TypeError, ValueError):
            content_id_int = None
        text = (payload.get('text') or '').strip()
        excerpt = text[:400] + ('…' if len(text) > 400 else '')
        chunk_index = payload.get('chunk_index')
        try:
            chunk_index = int(chunk_index) if chunk_index is not None else None
        except (TypeError, ValueError):
            chunk_index = None

        info = meta.get(content_id_int, {}) if content_id_int is not None else {}
        has_transcript = bool(info.get('has_transcript'))
        media_type = info.get('media_type') or ''
        source_url = None
        transcript_url = None
        if content_id_int is not None:
            source_url, transcript_url = _source_urls(
                content_id=content_id_int,
                topic_id=topic_id,
                has_transcript=has_transcript,
            )

        sources.append({
            'index': index,
            'content_id': content_id_int,
            'title': info.get('title', '') if content_id_int else '',
            'media_type': media_type,
            'has_transcript': has_transcript,
            'chunk_index': chunk_index,
            'score': round(_score_of(hit), 4),
            'excerpt': excerpt,
            'source_url': source_url,
            'transcript_url': transcript_url,
            'text': text,
        })
    return sources


def format_context(sources: list[dict[str, Any]]) -> str:
    blocks = []
    budget = _max_context_chars()
    used = 0
    for src in sources:
        text = (src.get('text') or src.get('excerpt') or '').strip()
        if not text:
            continue
        title = src.get('title') or f"contenido {src.get('content_id') or '?'}"
        header = f"[{src['index']}] {title}"
        if src.get('chunk_index') is not None:
            header += f" (chunk {src['chunk_index']})"
        block = f"{header}\n{text}"
        if used + len(block) > budget and blocks:
            break
        blocks.append(block)
        used += len(block) + 2
    return '\n\n'.join(blocks)


def run_topic_chat(
    *,
    topic_id: int,
    topic_title: str,
    message: str,
    history: Optional[list[dict[str, str]]] = None,
    openai_client: Optional[OpenAIClient] = None,
    qdrant_client: Optional[QdrantClient] = None,
) -> dict[str, Any]:
    ready, reason = topic_chat_ready()
    if not ready and openai_client is None and qdrant_client is None:
        raise TopicChatError(reason, status_code=503)

    openai = openai_client or OpenAIClient()
    qdrant = qdrant_client or QdrantClient()

    try:
        query_vector = openai.embed(message)
    except OpenAIClientError as exc:
        logger.exception('Topic chat embed failed topic_id=%s', topic_id)
        raise TopicChatError(
            f'No se pudo generar el embedding de la pregunta: {exc}',
            status_code=502,
        ) from exc

    try:
        hits = qdrant.search(query_vector, topic_id=topic_id, limit=_top_k() * 2)
    except (QdrantClientError, requests.RequestException) as exc:
        logger.exception('Topic chat Qdrant search failed topic_id=%s', topic_id)
        raise TopicChatError(
            'No se pudo consultar los archivos indexados. '
            'Inténtalo de nuevo en unos segundos.',
            status_code=502,
        ) from exc

    hits = _dedupe_hits(hits, max_per_content=2)[: _top_k()]
    sources = build_sources_from_hits(hits, topic_id=topic_id)
    context = format_context(sources)

    if not context.strip():
        return {
            'answer': (
                'No encontré fragmentos indexados de transcripciones para este tema '
                'que respondan a tu pregunta. Puede que aún no haya embeddings o que '
                'la pregunta no coincida con el material disponible.'
            ),
            'sources': [],
            'topic_id': topic_id,
        }

    user_prompt = (
        f'Tema: {topic_title}\n\n'
        f'Contexto (fragmentos de transcripciones):\n{context}\n\n'
        f'Pregunta del usuario:\n{message}'
    )

    messages: list[dict[str, str]] = [{'role': 'system', 'content': SYSTEM_PROMPT}]
    for turn in (history or [])[-6:]:
        role = (turn.get('role') or '').strip()
        content = (turn.get('content') or '').strip()
        if role in ('user', 'assistant') and content:
            messages.append({'role': role, 'content': content[:4000]})
    messages.append({'role': 'user', 'content': user_prompt})

    try:
        answer = openai.chat(messages)
    except OpenAIClientError as exc:
        logger.exception('Topic chat completion failed topic_id=%s', topic_id)
        raise TopicChatError(
            f'No se pudo generar la respuesta del modelo: {exc}',
            status_code=502,
        ) from exc

    # Strip full chunk text from API response (keep excerpt only).
    public_sources = [
        {k: v for k, v in src.items() if k != 'text'}
        for src in sources
    ]
    return {
        'answer': answer,
        'sources': public_sources,
        'topic_id': topic_id,
    }
