"""Topic RAG chat: retrieve Qdrant chunks + ask OpenAI with strict grounding."""

from __future__ import annotations

import logging
import re
from typing import Any, Optional

import requests
from django.conf import settings

from content.models import Content, ContentTranscript
from content.transcript_utils import resolve_hash_source_text
from utils.openai_client import OpenAIClient, OpenAIClientError, openai_configured
from utils.qdrant_client import QdrantClient, QdrantClientError, qdrant_configured

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    'Eres un asistente de Academia Blockchain. Respondes preguntas sobre un tema '
    'usando ÚNICAMENTE los fragmentos de transcripciones proporcionados como contexto.\n'
    'Reglas:\n'
    '- Si el contexto menciona a la persona o concepto preguntado, resume lo que '
    'dicen esos fragmentos (aunque sea parcial). No digas que no aparece si el '
    'nombre sí está en el contexto.\n'
    '- Solo si el contexto realmente no habla del tema de la pregunta, di que no '
    'lo encuentras en los fragmentos recuperados (no afirmes que no existe en el '
    'tema completo).\n'
    '- Cita fuentes con [n] donde n es el número del fragmento.\n'
    '- Responde en español, de forma clara y educativa.\n'
    '- No inventes citas, títulos ni hechos fuera del contexto.'
)

EMPTY_RETRIEVAL_ANSWER = (
    'No pude recuperar fragmentos útiles de las transcripciones indexadas para '
    'responder a tu pregunta. Puede que la búsqueda semántica no haya coincidido '
    'con el material, o que aún falten embeddings.'
)

RETRIEVAL_MISS_ANSWER = (
    'La búsqueda semántica no recuperó bien los pasajes, aunque el nombre o '
    'concepto sí aparece en transcripciones indexadas de este tema. Prueba a '
    'reformular la pregunta (por ejemplo sin acentos o con más contexto), o '
    'vuelve a intentarlo en unos segundos.'
)

INDEX_GAP_ANSWER = (
    'Encontré menciones en el texto de las transcripciones, pero todavía no '
    'están indexadas para consultas (embeddings pendientes, obsoletos o con error). '
    'Un moderador debe reindexar esos archivos antes de poder consultarlos aquí.'
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


def extract_entity_keywords(message: str, *, explicit: Optional[str] = None) -> list[str]:
    """
    Proper nouns / distinctive tokens from a consultation question.

    Used for Postgres keyword fallback when dense retrieval misses names
    (e.g. "Adam Back") after small wording/accent changes.
    """
    if explicit and explicit.strip():
        return [explicit.strip()]

    text = (message or '').strip()
    if not text:
        return []

    keywords: list[str] = []
    for match in re.finditer(
        r'\b([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+)+)\b',
        text,
    ):
        keywords.append(match.group(1))

    multi_parts = {
        part.casefold()
        for kw in keywords
        for part in kw.split()
    }

    stop = {
        'que', 'qué', 'quien', 'quién', 'como', 'cómo', 'donde', 'dónde',
        'cual', 'cuál', 'sobre', 'dice', 'dicen', 'habla', 'hablan', 'tema',
        'the', 'who', 'what', 'where', 'about', 'from', 'with', 'this', 'that',
    }
    for token in re.findall(r'[\wÁÉÍÓÚÑáéíóúñ]{4,}', text, flags=re.UNICODE):
        if token.casefold() in stop or token.casefold() in multi_parts:
            continue
        if token[0].isupper() and token not in keywords:
            keywords.append(token)

    seen: set[str] = set()
    ordered: list[str] = []
    for kw in keywords:
        key = kw.casefold()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(kw)
    return ordered


def snippet_around(text: str, keyword: str, *, radius: int = 220) -> str:
    lower = text.casefold()
    needle = keyword.casefold()
    pos = lower.find(needle)
    if pos < 0:
        return (text[: radius * 2] + ('…' if len(text) > radius * 2 else ''))
    start = max(0, pos - radius)
    end = min(len(text), pos + len(keyword) + radius)
    snippet = text[start:end].strip()
    if start > 0:
        snippet = '…' + snippet
    if end < len(text):
        snippet = snippet + '…'
    return snippet


def postgres_keyword_matches(
    topic_id: int,
    keywords: list[str],
    *,
    limit: int = 20,
    indexed_only: bool = False,
) -> list[dict[str, Any]]:
    """Find topic transcripts whose index text mentions keywords."""
    if not keywords:
        return []

    qs = ContentTranscript.objects.filter(
        content__topics__id=topic_id,
        content__media_type__in=('VIDEO', 'AUDIO', 'TEXT'),
    ).select_related('content').distinct()
    if indexed_only:
        qs = qs.filter(embedding_status=ContentTranscript.EMBEDDING_STATUS_INDEXED)

    matches: list[dict[str, Any]] = []
    for transcript in qs:
        body = resolve_hash_source_text(transcript) or ''
        if not body:
            continue
        hit_keywords = [kw for kw in keywords if kw.casefold() in body.casefold()]
        if not hit_keywords:
            continue
        primary = hit_keywords[0]
        matches.append({
            'content_id': transcript.content_id,
            'title': transcript.content.original_title or '',
            'media_type': transcript.content.media_type or '',
            'embedding_status': transcript.embedding_status,
            'chunk_count': transcript.chunk_count,
            'text_hash': transcript.text_hash,
            'embedded_text_hash': transcript.embedded_text_hash,
            'matched_keywords': hit_keywords,
            'snippet': snippet_around(body, primary),
        })
        if len(matches) >= limit:
            break
    return matches


def sources_mention_keywords(sources: list[dict[str, Any]], keywords: list[str]) -> bool:
    if not keywords:
        return False
    for src in sources or []:
        blob = f"{src.get('excerpt') or ''} {src.get('text') or ''} {src.get('title') or ''}"
        if any(kw.casefold() in blob.casefold() for kw in keywords):
            return True
    return False


def keyword_fallback_hits(
    topic_id: int,
    keywords: list[str],
    *,
    limit: int = 4,
    exclude_content_ids: Optional[set[int]] = None,
) -> list[dict[str, Any]]:
    """Build synthetic Qdrant-like hits from indexed Postgres snippets."""
    exclude = exclude_content_ids or set()
    matches = postgres_keyword_matches(
        topic_id,
        keywords,
        limit=limit + len(exclude) + 4,
        indexed_only=True,
    )
    hits: list[dict[str, Any]] = []
    for match in matches:
        content_id = match.get('content_id')
        if content_id in exclude:
            continue
        text = (match.get('snippet') or '').strip()
        if not text:
            continue
        hits.append({
            'score': 0.99,
            'payload': {
                'topic_id': topic_id,
                'content_id': content_id,
                'chunk_index': None,
                'text': text,
                'retrieval': 'keyword_fallback',
            },
        })
        if len(hits) >= limit:
            break
    return hits


def merge_keyword_fallback(
    hits: list[dict[str, Any]],
    *,
    topic_id: int,
    message: str,
) -> list[dict[str, Any]]:
    """
    If dense hits omit entity keywords that exist in indexed transcripts,
    prepend Postgres keyword windows so the LLM sees the name.
    """
    keywords = extract_entity_keywords(message)
    if not keywords:
        return hits

    # Peek whether current hit texts already mention the entity.
    provisional = []
    for hit in hits:
        payload = hit.get('payload') or {}
        provisional.append({
            'excerpt': (payload.get('text') or '')[:400],
            'text': payload.get('text') or '',
            'title': '',
        })
    if sources_mention_keywords(provisional, keywords):
        return hits

    # Only skip contents whose dense hit already mentions the keyword.
    already: set[int] = set()
    for hit in hits:
        payload = hit.get('payload') or {}
        text = payload.get('text') or ''
        if not any(kw.casefold() in text.casefold() for kw in keywords):
            continue
        cid = payload.get('content_id')
        try:
            already.add(int(cid))
        except (TypeError, ValueError):
            pass

    fallback = keyword_fallback_hits(
        topic_id,
        keywords,
        limit=min(4, _top_k()),
        exclude_content_ids=already,
    )
    if not fallback:
        return hits

    logger.info(
        'Topic chat keyword fallback topic_id=%s keywords=%s injected=%s',
        topic_id,
        keywords,
        len(fallback),
    )
    # Prefer keyword windows, then dense hits; dedupe caps per content.
    return _dedupe_hits(fallback + hits, max_per_content=2)[: _top_k()]


def empty_retrieval_answer(*, topic_id: int, message: str) -> str:
    """Honest fixed answer when no usable context could be built."""
    keywords = extract_entity_keywords(message)
    if not keywords:
        return EMPTY_RETRIEVAL_ANSWER

    matches = postgres_keyword_matches(topic_id, keywords, limit=8)
    indexed = [m for m in matches if m.get('embedding_status') == 'indexed']
    if indexed:
        return RETRIEVAL_MISS_ANSWER
    if matches:
        return INDEX_GAP_ANSWER
    return EMPTY_RETRIEVAL_ANSWER


def _load_content_metadata(content_ids: list[int]) -> dict[int, dict[str, str]]:
    if not content_ids:
        return {}
    rows = Content.objects.filter(pk__in=content_ids).values('id', 'original_title', 'media_type')
    return {
        row['id']: {
            'title': row['original_title'] or '',
            'media_type': row['media_type'] or '',
        }
        for row in rows
    }


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
    metadata_by_id = _load_content_metadata(list(dict.fromkeys(content_ids)))

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

        meta = metadata_by_id.get(content_id_int, {}) if content_id_int else {}
        title = meta.get('title', '')
        media_type = meta.get('media_type', '')

        transcript_url = None
        if content_id_int is not None:
            if media_type == 'TEXT':
                if topic_id:
                    transcript_url = f'/content/{content_id_int}/topic/{topic_id}'
                else:
                    transcript_url = f'/content/{content_id_int}/library'
            else:
                transcript_url = f'/content/{content_id_int}/transcript?context=topic'
                if topic_id:
                    transcript_url += f'&topicId={topic_id}'

        sources.append({
            'index': index,
            'content_id': content_id_int,
            'title': title,
            'media_type': media_type,
            'chunk_index': chunk_index,
            'score': round(_score_of(hit), 4),
            'excerpt': excerpt,
            'transcript_url': transcript_url,
            'url': transcript_url,
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
    hits = merge_keyword_fallback(hits, topic_id=topic_id, message=message)
    sources = build_sources_from_hits(hits, topic_id=topic_id)
    context = format_context(sources)

    if not context.strip():
        return {
            'answer': empty_retrieval_answer(topic_id=topic_id, message=message),
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
