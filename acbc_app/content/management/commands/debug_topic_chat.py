"""Debug topic RAG consultations: Postgres keyword evidence vs Qdrant retrieval."""

from __future__ import annotations

import json

from django.core.management.base import BaseCommand, CommandError

from content.models import Topic, TopicChatQuery
from content.topic_chat_debug import diagnose_live_retrieval, diagnose_saved_query


class Command(BaseCommand):
    help = (
        'Diagnose topic chat "not found" answers: compare Postgres transcript '
        'keyword hits with Qdrant retrieval (and optionally a saved TopicChatQuery).'
    )

    def add_arguments(self, parser):
        parser.add_argument('--topic-id', type=int, default=None)
        parser.add_argument(
            '--message',
            type=str,
            default=None,
            help='Question to embed + search (live retrieval; needs OpenAI + Qdrant)',
        )
        parser.add_argument(
            '--query-id',
            type=int,
            default=None,
            help='Inspect a saved TopicChatQuery (no OpenAI/Qdrant required)',
        )
        parser.add_argument(
            '--keyword',
            type=str,
            default=None,
            help='Entity/phrase to probe (default: guessed from the question, e.g. Adam Back)',
        )
        parser.add_argument(
            '--json',
            action='store_true',
            help='Print the full diagnostic report as JSON',
        )

    def handle(self, *args, **options):
        query_id = options.get('query_id')
        topic_id = options.get('topic_id')
        message = options.get('message')
        keyword = options.get('keyword')
        as_json = options.get('json')

        if not query_id and not (topic_id and message):
            raise CommandError(
                'Provide --query-id ID, or both --topic-id and --message.\n'
                'Examples:\n'
                '  python manage.py debug_topic_chat --query-id 42 --keyword "Adam Back"\n'
                '  python manage.py debug_topic_chat --topic-id 12 '
                '--message "¿Quién es Adam Back?" --keyword "Adam Back"'
            )

        if query_id:
            try:
                report = diagnose_saved_query(query_id, keyword=keyword)
            except TopicChatQuery.DoesNotExist as exc:
                raise CommandError(f'TopicChatQuery id={query_id} not found') from exc
        else:
            if not Topic.objects.filter(pk=topic_id).exists():
                raise CommandError(f'Topic id={topic_id} not found')
            report = diagnose_live_retrieval(
                topic_id=topic_id,
                message=message,
                keyword=keyword,
            )

        if as_json:
            self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2, default=str))
            return

        self._print_human(report)

    def _print_human(self, report: dict) -> None:
        classification = report.get('classification') or {}
        mode = classification.get('mode', '?')
        self.stdout.write(self.style.MIGRATE_HEADING(f'Classification: {mode}'))
        self.stdout.write(classification.get('detail') or '')
        self.stdout.write('')

        self.stdout.write(f"Topic: {report.get('topic_id')} — {report.get('topic_title')!r}")
        if report.get('query_id') is not None:
            self.stdout.write(f"Saved query id: {report['query_id']}")
        if report.get('question'):
            self.stdout.write(f"Question: {report['question']}")
        if report.get('message'):
            self.stdout.write(f"Message: {report['message']}")
        self.stdout.write(f"Keywords probed: {report.get('keywords')}")

        if 'chat_enabled' in report:
            self.stdout.write(
                f"chat_enabled={report.get('chat_enabled')} "
                f"indexed_transcript_count={report.get('indexed_transcript_count')} "
                f"qdrant_points={report.get('qdrant_point_count')}"
            )
            self.stdout.write(
                f"runtime_ready={report.get('runtime_ready')} "
                f"({report.get('runtime_reason') or 'ok'})"
            )

        pg = report.get('postgres_matches') or []
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_LABEL(f'Postgres keyword matches ({len(pg)})'))
        if not pg:
            self.stdout.write('  (none)')
        for row in pg[:15]:
            self.stdout.write(
                f"  content_id={row['content_id']} status={row['embedding_status']} "
                f"chunks={row.get('chunk_count')} title={row.get('title')!r}"
            )
            self.stdout.write(f"    matched={row.get('matched_keywords')}")
            self.stdout.write(f"    snippet={row.get('snippet')!r}")

        sources = report.get('sources') or []
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_LABEL(f'Retrieved sources ({len(sources)})'))
        if not sources:
            self.stdout.write('  (none)')
        for src in sources:
            self.stdout.write(
                f"  [{src.get('index')}] content_id={src.get('content_id')} "
                f"chunk={src.get('chunk_index')} score={src.get('score')} "
                f"title={src.get('title')!r}"
            )
            excerpt = (src.get('excerpt') or '')[:200]
            if excerpt:
                self.stdout.write(f"    excerpt={excerpt!r}")

        hits = report.get('hits') or []
        if hits and not sources:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING(
                'Raw hits existed but sources/context were empty — check payload.text'
            ))
            for hit in hits:
                self.stdout.write(
                    f"  score={hit.get('score')} content_id={hit.get('content_id')} "
                    f"has_text={hit.get('has_text')}"
                )

        if report.get('answer_preview'):
            self.stdout.write('')
            self.stdout.write(self.style.MIGRATE_LABEL('Answer preview'))
            self.stdout.write(report['answer_preview'])

        self.stdout.write('')
        self._print_next_steps(mode)

    def _print_next_steps(self, mode: str) -> None:
        tips = {
            'retrieval_miss': (
                'Next: confirm Qdrant payloads include those content_ids '
                '(check_qdrant --topic-id N; inspect embed worker). '
                'Consider hybrid keyword fallback for entity questions.'
            ),
            'index_gap': (
                'Next: embed/ack the matching transcripts '
                '(embedding-ingest PUT → indexed) then retry the consultation.'
            ),
            'empty_retrieval': (
                'Next: verify topic membership, transcript text, and keyword spelling '
                'in processed_plain.'
            ),
            'grounding_refuse': (
                'Next: inspect source excerpts vs the system prompt; context may be '
                'truncated or the model may be over-refusing.'
            ),
            'config_missing': (
                'Next: export OPENAI_API_KEY, QDRANT_URL, QDRANT_API_KEY for live search.'
            ),
            'ok': 'Retrieval looks healthy for the probed keyword.',
        }
        tip = tips.get(mode)
        if tip:
            self.stdout.write(self.style.NOTICE(tip))
