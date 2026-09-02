"""Diagnostics for topic RAG consultations (retrieval vs grounding failures)."""

from __future__ import annotations

from typing import Any, Optional

from content.models import Topic, TopicChatQuery
from content.topic_chat import (
    EMPTY_RETRIEVAL_ANSWER,
    INDEX_GAP_ANSWER,
    RETRIEVAL_MISS_ANSWER,
    _dedupe_hits,
    _top_k,
    build_sources_from_hits,
    extract_entity_keywords,
    format_context,
    postgres_keyword_matches,
    topic_chat_ready,
)

# Fixed empty-context answers from run_topic_chat (no LLM call).
EMPTY_RETRIEVAL_ANSWER_PREFIX = EMPTY_RETRIEVAL_ANSWER[:32]
_FIXED_ANSWER_PREFIXES = (
    EMPTY_RETRIEVAL_ANSWER[:40],
    RETRIEVAL_MISS_ANSWER[:40],
    INDEX_GAP_ANSWER[:40],
)

_REFUSAL_MARKERS = (
    'no la encuentro',
    'no lo encuentro',
    'no encuentro',
    'no encontré',
    'no aparece',
    'no se menciona',
    'no hay información',
    'no pude recuperar',
    'no recuperó bien',
)


def _looks_like_refusal(answer: str) -> bool:
    lowered = (answer or '').casefold()
    return any(marker in lowered for marker in _REFUSAL_MARKERS)


def extract_debug_keywords(message: str, *, explicit: Optional[str] = None) -> list[str]:
    return extract_entity_keywords(message, explicit=explicit)


def sources_mention_keywords(sources: list[dict[str, Any]], keywords: list[str]) -> list[int]:
    """Return source indexes whose excerpt/text mentions any keyword."""
    if not keywords:
        return []
    hits: list[int] = []
    for src in sources or []:
        blob = f"{src.get('excerpt') or ''} {src.get('text') or ''} {src.get('title') or ''}"
        if any(kw.casefold() in blob.casefold() for kw in keywords):
            try:
                hits.append(int(src.get('index')))
            except (TypeError, ValueError):
                hits.append(len(hits) + 1)
    return hits


def classify_failure(
    *,
    answer: str,
    sources: list[dict[str, Any]],
    keywords: list[str],
    postgres_matches: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Classify why a consultation missed an entity / returned "not found".

    Modes:
    - empty_retrieval: no usable Qdrant context (fixed Spanish answer, no LLM)
    - retrieval_miss: Postgres has the keyword but retrieved sources do not
    - index_gap: keyword in Postgres only on non-indexed / stale transcripts
    - grounding_refuse: keyword appears in sources but the model still refuses
    - ok: sources mention the keyword (or no keyword to check)
    - unknown: no Postgres evidence and no keyword hits in sources
    """
    answer = answer or ''
    sources = sources or []
    empty_sources = len(sources) == 0
    fixed_empty = any(answer.startswith(prefix) for prefix in _FIXED_ANSWER_PREFIXES)
    source_hit_indexes = sources_mention_keywords(sources, keywords)

    indexed_pg = [m for m in postgres_matches if m.get('embedding_status') == 'indexed']
    non_indexed_pg = [m for m in postgres_matches if m.get('embedding_status') != 'indexed']

    if keywords and source_hit_indexes:
        mode = 'ok'
        detail = (
            f'Retrieved sources mention {keywords!r} at indexes {source_hit_indexes}. '
            'If the UI still looks wrong, inspect the model answer / citation mapping.'
        )
    elif fixed_empty or empty_sources:
        if indexed_pg:
            mode = 'retrieval_miss'
            detail = (
                'Dense Qdrant search returned no usable chunks, but Postgres has '
                f'{len(indexed_pg)} indexed transcript(s) containing {keywords!r}. '
                'Likely a vector-ranking miss on a proper noun / short entity query.'
            )
        elif postgres_matches:
            mode = 'index_gap'
            detail = (
                f'Postgres mentions {keywords!r} in {len(postgres_matches)} transcript(s), '
                f'but none are embedding_status=indexed '
                f'(statuses={[m["embedding_status"] for m in non_indexed_pg[:8]]}). '
                'Re-run the embed worker / ack before expecting RAG hits.'
            )
        else:
            mode = 'empty_retrieval'
            detail = (
                'No Qdrant context and no Postgres keyword hits for this topic. '
                'Confirm the topic_id, that transcripts exist, and the keyword spelling.'
            )
    elif keywords and indexed_pg and not source_hit_indexes:
        mode = 'retrieval_miss'
        detail = (
            f'Top-{len(sources)} retrieved chunks do not mention {keywords!r}, '
            f'but {len(indexed_pg)} indexed Postgres transcript(s) do. '
            'Classic dense-retrieval miss — keyword fallback should inject snippets.'
        )
    elif keywords and postgres_matches and not source_hit_indexes:
        mode = 'index_gap'
        detail = (
            f'Retrieved chunks omit {keywords!r}; Postgres only has non-indexed matches '
            f'(statuses={[m["embedding_status"] for m in non_indexed_pg[:8]]}).'
        )
    elif keywords and not source_hit_indexes:
        mode = 'unknown'
        detail = (
            f'No Postgres or source excerpt mentions {keywords!r}. '
            'The model refusal may be correct for this corpus.'
        )
    else:
        if _looks_like_refusal(answer):
            mode = 'grounding_refuse'
            detail = (
                'Model refused based on retrieved context. Re-run with --keyword to check '
                'whether the entity was missing from the top chunks.'
            )
        else:
            mode = 'ok'
            detail = 'Consultation returned sources and a non-refusal answer.'

    if keywords and source_hit_indexes and _looks_like_refusal(answer):
        mode = 'grounding_refuse'
        detail = (
            f'Sources mention {keywords!r} at {source_hit_indexes}, but the chat model '
            'still answered as if missing. Inspect prompt grounding / truncated context.'
        )

    return {
        'mode': mode,
        'detail': detail,
        'empty_sources': empty_sources,
        'fixed_empty_retrieval_answer': fixed_empty,
        'source_keyword_indexes': source_hit_indexes,
        'postgres_match_count': len(postgres_matches),
        'postgres_indexed_match_count': len(indexed_pg),
    }


def diagnose_saved_query(
    query_id: int,
    *,
    keyword: Optional[str] = None,
) -> dict[str, Any]:
    query = TopicChatQuery.objects.select_related('topic').get(pk=query_id)
    keywords = extract_debug_keywords(query.question, explicit=keyword)
    pg_matches = postgres_keyword_matches(query.topic_id, keywords)
    classification = classify_failure(
        answer=query.answer,
        sources=query.sources or [],
        keywords=keywords,
        postgres_matches=pg_matches,
    )
    return {
        'query_id': query.id,
        'topic_id': query.topic_id,
        'topic_title': query.topic.title,
        'question': query.question,
        'answer_preview': (query.answer or '')[:400],
        'sources': query.sources or [],
        'keywords': keywords,
        'postgres_matches': pg_matches,
        'classification': classification,
    }


def diagnose_live_retrieval(
    *,
    topic_id: int,
    message: str,
    keyword: Optional[str] = None,
    openai_client=None,
    qdrant_client=None,
) -> dict[str, Any]:
    """
    Run embed + Qdrant search (no chat completion) and classify against Postgres.
    """
    from content.topic_chat import (
        _filter_hits_by_score,
        context_mentions_entities,
        empty_retrieval_answer,
        merge_keyword_fallback,
    )

    topic = Topic.objects.get(pk=topic_id)
    keywords = extract_debug_keywords(message, explicit=keyword)
    pg_matches = postgres_keyword_matches(topic_id, keywords)

    ready, reason = topic_chat_ready()
    report: dict[str, Any] = {
        'topic_id': topic.id,
        'topic_title': topic.title,
        'chat_enabled': topic.chat_enabled,
        'indexed_transcript_count': topic.indexed_transcript_count(),
        'message': message,
        'keywords': keywords,
        'postgres_matches': pg_matches,
        'runtime_ready': ready,
        'runtime_reason': reason,
        'hits': [],
        'sources': [],
        'retrieved_chunk_count': 0,
        'used_chunk_count': 0,
        'classification': None,
    }

    if not ready and openai_client is None and qdrant_client is None:
        report['classification'] = {
            'mode': 'config_missing',
            'detail': reason,
        }
        return report

    from utils.openai_client import OpenAIClient, OpenAIClientError
    from utils.qdrant_client import QdrantClient, QdrantClientError
    import requests

    openai = openai_client or OpenAIClient()
    qdrant = qdrant_client or QdrantClient()

    try:
        vector = openai.embed(message)
    except OpenAIClientError as exc:
        report['classification'] = {
            'mode': 'embed_failed',
            'detail': str(exc),
        }
        return report

    try:
        raw_hits = qdrant.search(vector, topic_id=topic_id, limit=_top_k() * 2)
    except (QdrantClientError, requests.RequestException) as exc:
        report['classification'] = {
            'mode': 'qdrant_failed',
            'detail': str(exc),
        }
        return report

    scored_hits = _filter_hits_by_score(raw_hits)
    hits = _dedupe_hits(scored_hits, max_per_content=2)[: _top_k()]
    hits = merge_keyword_fallback(hits, topic_id=topic_id, message=message)
    sources = build_sources_from_hits(hits, topic_id=topic_id)
    context, used_sources = format_context(sources)
    report['hits'] = [
        {
            'score': round(float(h.get('score') or 0), 4),
            'content_id': (h.get('payload') or {}).get('content_id'),
            'chunk_index': (h.get('payload') or {}).get('chunk_index'),
            'has_text': bool(((h.get('payload') or {}).get('text') or '').strip()),
            'retrieval': (h.get('payload') or {}).get('retrieval') or 'dense',
            'excerpt': ((h.get('payload') or {}).get('text') or '')[:240],
        }
        for h in hits
    ]
    report['sources'] = [{k: v for k, v in s.items() if k != 'text'} for s in used_sources]
    report['retrieved_chunk_count'] = len(sources)
    report['used_chunk_count'] = len(used_sources)
    report['context_chars'] = len(context)
    report['entity_in_context'] = context_mentions_entities(context, keywords) if keywords else None
    report['qdrant_point_count'] = None
    try:
        report['qdrant_point_count'] = qdrant.count_topic(topic_id)
    except Exception:
        pass

    if not context.strip():
        fake_answer = empty_retrieval_answer(topic_id=topic_id, message=message)
    elif keywords and not context_mentions_entities(context, keywords):
        fake_answer = empty_retrieval_answer(topic_id=topic_id, message=message)
    else:
        fake_answer = ''
    report['classification'] = classify_failure(
        answer=fake_answer,
        sources=used_sources,
        keywords=keywords,
        postgres_matches=pg_matches,
    )
    return report
