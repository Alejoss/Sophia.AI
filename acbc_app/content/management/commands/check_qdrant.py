"""Verify Qdrant Cloud connectivity and optionally create the collection."""

from django.conf import settings
from django.core.management.base import BaseCommand

from utils.qdrant_client import (
    DEFAULT_VECTOR_SIZE,
    QdrantClient,
    QdrantClientError,
    qdrant_configured,
)


class Command(BaseCommand):
    help = (
        'Check Qdrant URL/API key from settings and optionally ensure '
        'QDRANT_COLLECTION exists (3072-d Cosine for text-embedding-3-large).'
    )
    # This command talks to Qdrant, not Postgres; skip Django system checks
    # so a broken local DB password does not block connectivity tests.
    requires_system_checks = []

    def add_arguments(self, parser):
        parser.add_argument(
            '--ensure-collection',
            action='store_true',
            help='Create the collection if it does not exist',
        )
        parser.add_argument(
            '--topic-id',
            type=int,
            default=None,
            help='If set, print point count for this topic_id filter',
        )

    def handle(self, *args, **options):
        if not qdrant_configured():
            self.stderr.write(self.style.ERROR(
                'QDRANT_URL and QDRANT_API_KEY are not both set in the environment.'
            ))
            self.stdout.write(
                'Add to acbc_app/.env:\n'
                '  QDRANT_URL=https://….aws.cloud.qdrant.io\n'
                '  QDRANT_API_KEY=…\n'
                '  QDRANT_COLLECTION=sophia_acbc_topic_chunks\n'
            )
            raise SystemExit(1)

        try:
            client = QdrantClient()
            health = client.health()
        except QdrantClientError as exc:
            self.stderr.write(self.style.ERROR(f'Qdrant connection failed: {exc}'))
            raise SystemExit(1)

        self.stdout.write(self.style.SUCCESS('Qdrant connection OK'))
        self.stdout.write(f"  URL: {health['url']}")
        self.stdout.write(f"  Collection setting: {health['collection']}")
        self.stdout.write(f"  Collection exists: {health['collection_exists']}")
        self.stdout.write(f"  All collections: {health['collections']}")

        dims = getattr(settings, 'QDRANT_VECTOR_SIZE', DEFAULT_VECTOR_SIZE)
        if options['ensure_collection']:
            try:
                created = client.ensure_collection(vector_size=int(dims))
            except QdrantClientError as exc:
                self.stderr.write(self.style.ERROR(f'ensure_collection failed: {exc}'))
                raise SystemExit(1)
            if created:
                self.stdout.write(self.style.SUCCESS(
                    f"Created collection '{client.collection}' "
                    f"(size={dims}, Cosine)"
                ))
            else:
                self.stdout.write(f"Collection '{client.collection}' already exists")

        topic_id = options.get('topic_id')
        if topic_id is not None:
            if not client.collection_exists():
                self.stderr.write(self.style.WARNING(
                    'Collection missing; cannot count points. Re-run with --ensure-collection.'
                ))
                raise SystemExit(1)
            try:
                count = client.count_topic(topic_id)
            except QdrantClientError as exc:
                self.stderr.write(self.style.ERROR(f'count failed: {exc}'))
                raise SystemExit(1)
            self.stdout.write(f'  Points for topic_id={topic_id}: {count}')

        self.stdout.write(f'  Expected vector size: {dims}')
