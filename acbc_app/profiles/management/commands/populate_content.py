from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
import random
from faker import Faker
from django.db import IntegrityError
from django.utils import timezone
from datetime import timedelta

from content.models import (
    Topic,
    Content,
    ContentProfile,
    ContentTranscript,
    Library,
    Collection,
    Publication,
)
from events.models import Event

fake = Faker()

# Configuration
CONFIG = {
    'topics': {
        'count': 8,
        'moderators_per_topic': (1, 3),  # (min, max)
    },
    'content': {
        'items_per_topic': 15,
        'profiles_per_content': (1, 4),  # (min, max)
        'publication_probability': 0.4,  # 40% chance of creating a publication
    },
    'libraries': {
        'collections_per_library': (2, 5),  # (min, max)
    },
    'events': {
        'events_per_user': (1, 3),  # (min, max)
        'future_event_probability': 0.6,  # 60% chance of future events
        'platforms': [
            'google_meet',
            'jitsi',
            'microsoft_teams',
            'telegram',
            'tox',
            'twitch',
            'zoom',
            'other',
        ],
    },
}

BASE_TOPIC_TITLES = [
    'Blockchain Fundamentals',
    'Smart Contracts',
    'DeFi Protocols',
    'Cryptocurrency Trading',
    'Web3 Development',
    'NFTs and Digital Art',
    'Consensus Mechanisms',
    'Cryptography Basics',
]

# Extra topics used for Bitcoin transcript-anchor / payment QA.
TRANSCRIPT_TOPIC_SPECS = [
    {
        'title': 'Bitcoin Anchoring Lab',
        'description': (
            'Tema de prueba para anclar transcripts en Bitcoin (OP_RETURN) '
            'y validar solicitudes de pago / revisión admin.'
        ),
        'transcripts': [
            (
                'Lección 1 — Qué es un ancla de transcript',
                (
                    'Bienvenidos al laboratorio de anclaje en Bitcoin. En esta lección '
                    'explicamos cómo un hash SHA-256 del transcript se publica en una '
                    'salida OP_RETURN con el prefijo ACBC1. El objetivo es demostrar '
                    'integridad del texto sin subir el contenido completo a la cadena.'
                ),
            ),
            (
                'Lección 2 — Flujo de pago y revisión',
                (
                    'Después de solicitar el anclaje, el usuario puede pagar con '
                    'NOWPayments o con Bitcoin Cash directo. El estado pasa a '
                    'paid_pending_review hasta que un administrador aprueba o rechaza '
                    'la solicitud. Este párrafo es distinto a propósito para generar '
                    'otro text_hash único.'
                ),
            ),
        ],
    },
    {
        'title': 'Proof of Existence Demo',
        'description': (
            'Contenido demo con transcripts listos para probar la UI de certificación '
            'y el explorador de transacciones.'
        ),
        'transcripts': [
            (
                'Demo A — Hash y confirmaciones',
                (
                    'Proof of Existence Demo, parte A. Primero calculamos el text_hash '
                    'normalizado del processed_plain. Luego construimos la transacción '
                    'con fee rate acotado y esperamos confirmaciones en el explorador. '
                    'Cada confirmación actualiza el estado del TranscriptAnchor.'
                ),
            ),
            (
                'Demo B — Re-anclar tras cambio de texto',
                (
                    'Proof of Existence Demo, parte B. Si el transcript cambia, el hash '
                    'también cambia y se puede abrir una nueva solicitud de anclaje. '
                    'El hash anterior permanece en la cadena como evidencia histórica '
                    'del texto certificado en ese momento.'
                ),
            ),
        ],
    },
    {
        'title': 'Transcript Certification Samples',
        'description': (
            'Muestras adicionales de video+transcript para pruebas end-to-end '
            'de BCH direct y NOWPayments.'
        ),
        'transcripts': [
            (
                'Sample 1 — BCH exact amount',
                (
                    'Sample de certificación uno. En el pago BCH directo el sistema '
                    'asigna un monto exacto en satoshis a una sola dirección de cobro. '
                    'El usuario transfiere ese monto y confirma Ya pagué; el backend '
                    'verifica en el explorador y marca la solicitud como pagada.'
                ),
            ),
            (
                'Sample 2 — NOWPayments invoice',
                (
                    'Sample de certificación dos. Con NOWPayments se crea una factura '
                    'y el IPN o el poll actualizan CryptoPayment. Al cumplirse el pago, '
                    'la solicitud de anclaje queda en revisión administrativa con el '
                    'mismo entitlement que el flujo BCH.'
                ),
            ),
        ],
    },
]


class Command(BaseCommand):
    help = (
        'Populates topics, content, libraries, publications, and events. '
        'Use --fill-topics and --extra-topics/--with-transcripts for anchor QA.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing content data before populating',
        )
        parser.add_argument(
            '--skip-existing',
            action='store_true',
            dest='skip_existing',
            help='Skip creation of objects that already exist',
        )
        parser.add_argument(
            '--no-base',
            action='store_true',
            help='Skip the default 8-topic bulk seed; only fill / extra transcript topics',
        )
        parser.add_argument(
            '--no-events',
            action='store_true',
            help='Do not create events',
        )
        parser.add_argument(
            '--fill-topics',
            action='store_true',
            help='Ensure every topic has at least --min-content items',
        )
        parser.add_argument(
            '--min-content',
            type=int,
            default=5,
            help='Minimum contents per topic when using --fill-topics (default: 5)',
        )
        parser.add_argument(
            '--extra-topics',
            type=int,
            default=0,
            help=(
                'Create N transcript-oriented topics (max 3 curated specs; '
                'beyond that titles are generated). Typical QA value: 3'
            ),
        )
        parser.add_argument(
            '--with-transcripts',
            action='store_true',
            help='Attach ContentTranscript (text_hash via save()) to seeded VIDEO content',
        )
        parser.add_argument(
            '--transcripts-per-topic',
            type=int,
            default=2,
            help='VIDEO+transcript items per extra topic (default: 2)',
        )
        parser.add_argument(
            '--seed-transcripts',
            action='store_true',
            help=(
                'Shorthand for QA: --no-base --fill-topics --extra-topics 3 '
                '--with-transcripts --skip-existing --no-events'
            ),
        )

    def handle(self, *args, **options):
        if options['seed_transcripts']:
            options['no_base'] = True
            options['fill_topics'] = True
            options['extra_topics'] = max(options['extra_topics'], 3)
            options['with_transcripts'] = True
            options['skip_existing'] = True
            options['no_events'] = True

        if options['clear']:
            self.clear_database()

        self.stdout.write('Starting content population...')
        self.skip_existing = options.get('skip_existing', False)
        self.with_transcripts = options.get('with_transcripts', False)

        users = list(User.objects.all())
        if not users:
            self.stdout.write(self.style.ERROR('No users found. Please run populate_users first.'))
            return

        created_topics = []
        if not options.get('no_base'):
            created_topics = self.create_topics(users)
            self.create_content_and_profiles(created_topics, users)
            if not options.get('no_events'):
                self.create_events(users)
        elif not options.get('no_events') and not options.get('seed_transcripts'):
            self.create_events(users)

        if options.get('fill_topics'):
            self.fill_topics(users, options['min_content'])

        extra_n = options.get('extra_topics') or 0
        if extra_n > 0:
            self.create_transcript_topics(
                users,
                count=extra_n,
                transcripts_per_topic=options['transcripts_per_topic'],
            )

        self.stdout.write(self.style.SUCCESS('Successfully populated content'))

    def clear_database(self):
        """Clear all content related data"""
        self.stdout.write('Clearing existing content data...')

        Event.objects.all().delete()
        Publication.objects.all().delete()
        ContentTranscript.objects.all().delete()
        ContentProfile.objects.all().delete()
        Content.objects.all().delete()
        Topic.objects.all().delete()

        self.stdout.write('Content data cleared successfully')

    def create_topics(self, users):
        """Create the default base topics with moderators.

        With --skip-existing, topics that already exist are omitted from the
        returned list so bulk content is not duplicated for them.
        """
        topics = []
        for title in BASE_TOPIC_TITLES:
            topic = self._get_or_create_topic(
                title,
                fake.text(max_nb_chars=500),
                users,
                return_existing=False,
            )
            if topic:
                topics.append(topic)
        return topics

    def _get_or_create_topic(self, title, description, users, *, return_existing=True):
        existing = Topic.objects.filter(title=title).first()
        if existing:
            if self.skip_existing and not return_existing:
                self.stdout.write(f'Skipping existing topic: {title}')
                return None
            if self.skip_existing:
                self.stdout.write(f'Reusing existing topic: {title}')
            else:
                self.stdout.write(self.style.WARNING(f'Topic already exists: {title}'))
            return existing

        try:
            topic = Topic.objects.create(
                title=title,
                description=description,
                creator=random.choice(users),
            )
            num_moderators = random.randint(*CONFIG['topics']['moderators_per_topic'])
            moderators = random.sample(users, min(num_moderators, len(users)))
            topic.moderators.add(*moderators)
            self.stdout.write(f'Created topic: {topic.title} with {len(moderators)} moderators')
            return topic
        except IntegrityError:
            self.stdout.write(self.style.WARNING(f'Failed to create topic: {title}'))
            return None

    def create_content_and_profiles(self, topics, users):
        """Create content and content profiles for the given topics"""
        for topic in topics:
            for _ in range(CONFIG['content']['items_per_topic']):
                media_type = random.choice(['VIDEO', 'AUDIO', 'TEXT', 'IMAGE'])
                attach_transcript = self.with_transcripts and media_type in ('VIDEO', 'AUDIO')
                self._create_content_item(
                    topic=topic,
                    users=users,
                    media_type=media_type,
                    original_title=f'{fake.catch_phrase()} - {topic.title}',
                    attach_transcript=attach_transcript,
                )

    def fill_topics(self, users, min_content):
        """Ensure every topic reaches a minimum content count."""
        self.stdout.write(f'Filling topics to at least {min_content} content items...')
        for topic in Topic.objects.all():
            current = topic.contents.count()
            needed = max(0, min_content - current)
            if needed == 0:
                self.stdout.write(f'Topic "{topic.title}" already has {current} items')
                continue

            self.stdout.write(f'Adding {needed} items to topic "{topic.title}" (had {current})')
            for i in range(needed):
                media_type = random.choice(['VIDEO', 'AUDIO', 'TEXT', 'IMAGE'])
                attach_transcript = self.with_transcripts and media_type in ('VIDEO', 'AUDIO')
                self._create_content_item(
                    topic=topic,
                    users=users,
                    media_type=media_type,
                    original_title=f'Fill {i + 1}: {fake.catch_phrase()} - {topic.title}',
                    attach_transcript=attach_transcript,
                )

    def create_transcript_topics(self, users, count, transcripts_per_topic):
        """Create curated (or generated) topics with VIDEO content + transcripts."""
        self.stdout.write(
            f'Creating {count} transcript topic(s) '
            f'({transcripts_per_topic} videos with transcript each)...'
        )

        for index in range(count):
            if index < len(TRANSCRIPT_TOPIC_SPECS):
                spec = TRANSCRIPT_TOPIC_SPECS[index]
                title = spec['title']
                description = spec['description']
                lesson_specs = list(spec['transcripts'])
            else:
                title = f'Transcript QA Topic {index + 1}'
                description = fake.text(max_nb_chars=300)
                lesson_specs = []

            while len(lesson_specs) < transcripts_per_topic:
                n = len(lesson_specs) + 1
                lesson_specs.append(
                    (
                        f'{title} — Video {n}',
                        (
                            f'Transcript de prueba número {n} para el tema "{title}". '
                            f'{fake.paragraph(nb_sentences=5)} '
                            f'Marcador único: topic-{index + 1}-lesson-{n}.'
                        ),
                    )
                )

            topic = self._get_or_create_topic(title, description, users)
            if topic is None:
                continue

            for lesson_title, plain in lesson_specs[:transcripts_per_topic]:
                # Prefer stable titles so --skip-existing / re-runs are idempotent.
                existing = Content.objects.filter(
                    original_title=lesson_title,
                    topics=topic,
                ).first()
                if existing and self.skip_existing:
                    if not ContentTranscript.objects.filter(content=existing).exists():
                        self._attach_transcript(existing, plain, language='es')
                        existing.refresh_from_db()
                        self.stdout.write(
                            f'Attached missing transcript to existing content '
                            f'{existing.id}: {lesson_title}'
                        )
                    else:
                        self.stdout.write(f'Skipping existing content: {lesson_title}')
                    continue

                content = self._create_content_item(
                    topic=topic,
                    users=users,
                    media_type='VIDEO',
                    original_title=lesson_title,
                    attach_transcript=True,
                    transcript_plain=plain,
                    force_visible_profile=True,
                )
                if content and ContentTranscript.objects.filter(content=content).exists():
                    content.transcript.refresh_from_db()
                    self.stdout.write(
                        f'  content_id={content.id} text_hash={content.transcript.text_hash}'
                    )

    def _create_content_item(
        self,
        topic,
        users,
        media_type,
        original_title,
        attach_transcript=False,
        transcript_plain=None,
        force_visible_profile=False,
    ):
        try:
            if self.skip_existing and Content.objects.filter(original_title=original_title).exists():
                self.stdout.write(f'Skipping existing content: {original_title}')
                return Content.objects.filter(original_title=original_title).first()

            uploader = random.choice(users)
            content = Content.objects.create(
                uploaded_by=uploader,
                media_type=media_type,
                original_title=original_title,
                original_author=fake.name(),
                url=fake.url() if random.choice([True, False]) else None,
            )
            content.topics.add(topic)

            max_profiles = min(len(users), CONFIG['content']['profiles_per_content'][1])
            min_profiles = min(len(users), CONFIG['content']['profiles_per_content'][0])
            num_profiles = random.randint(min_profiles, max_profiles)
            selected_users = users if len(users) <= num_profiles else random.sample(users, num_profiles)
            if uploader not in selected_users:
                selected_users = list(selected_users) + [uploader]

            for user in selected_users:
                library, _ = Library.objects.get_or_create(
                    user=user,
                    defaults={'name': f"{user.username}'s Library"},
                )
                collection, _ = Collection.objects.get_or_create(
                    library=library,
                    defaults={'name': fake.word()},
                )
                if self.skip_existing and ContentProfile.objects.filter(
                    content=content, user=user
                ).exists():
                    continue

                is_visible = True if force_visible_profile and user == uploader else random.choice([True, False])
                profile = ContentProfile.objects.create(
                    content=content,
                    user=user,
                    collection=collection,
                    title=original_title if user == uploader else fake.catch_phrase(),
                    author=fake.name(),
                    personal_note=fake.text(max_nb_chars=200),
                    is_visible=is_visible,
                    is_producer=user == uploader or random.choice([True, False]),
                )

                if random.random() < CONFIG['content']['publication_probability']:
                    Publication.objects.create(
                        user=user,
                        content_profile=profile,
                        text_content=fake.text(max_nb_chars=1000),
                        status=random.choice(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
                    )

            if attach_transcript:
                plain = transcript_plain or (
                    f'Transcript generado para "{original_title}". '
                    f'{fake.paragraph(nb_sentences=6)}'
                )
                self._attach_transcript(content, plain, language='es')

            self.stdout.write(
                f'Created content: {content.original_title} '
                f'({media_type}'
                f'{"+transcript" if attach_transcript else ""}) '
                f'with {len(selected_users)} profiles'
            )
            return content
        except IntegrityError:
            self.stdout.write(self.style.WARNING(f'Failed to create content: {original_title}'))
            return None

    def _attach_transcript(self, content, processed_plain, language='es'):
        """Create or update ContentTranscript; save() computes text_hash."""
        transcript, created = ContentTranscript.objects.get_or_create(
            content=content,
            defaults={
                'parsed_plain': processed_plain,
                'processed_plain': processed_plain,
                'obsidian_markdown': (
                    f'---\ntitle: {content.original_title}\nlanguage: {language}\n---\n\n'
                    f'{processed_plain}'
                ),
                'language': language,
                'format': 'SRT',
                'embedding_status': ContentTranscript.EMBEDDING_STATUS_SKIPPED,
            },
        )
        if not created:
            transcript.parsed_plain = processed_plain
            transcript.processed_plain = processed_plain
            transcript.language = language
            transcript.save()
        else:
            # get_or_create already saved once; reload to expose text_hash if needed
            transcript.refresh_from_db()
        return transcript

    def create_events(self, users):
        """Create events for users"""
        self.stdout.write('Creating events...')

        event_types = ['LIVE_COURSE', 'LIVE_CERTIFICATION', 'LIVE_MASTER_CLASS']

        for user in users:
            num_events = random.randint(*CONFIG['events']['events_per_user'])

            for event_num in range(num_events):
                try:
                    is_future = random.random() < CONFIG['events']['future_event_probability']

                    if is_future:
                        days_ahead = random.randint(1, 30)
                        start_date = timezone.now() + timedelta(days=days_ahead)
                        end_date = start_date + timedelta(hours=random.randint(1, 4))
                    else:
                        days_ago = random.randint(1, 30)
                        start_date = timezone.now() - timedelta(days=days_ago)
                        end_date = start_date + timedelta(hours=random.randint(1, 4))

                    platform = random.choice(CONFIG['events']['platforms'])
                    other_platform = fake.word() if platform == 'other' else ''

                    event = Event.objects.create(
                        event_type=random.choice(event_types),
                        owner=user,
                        title=f"{fake.catch_phrase()} - {user.username}'s Event {event_num + 1}",
                        description=fake.text(max_nb_chars=1000),
                        platform=platform,
                        other_platform=other_platform,
                        reference_price=random.uniform(0, 100),
                        date_start=start_date,
                        date_end=end_date,
                        schedule_description=fake.text(max_nb_chars=500),
                    )

                    self.stdout.write(f'Created event: {event.title} for {user.username}')
                except IntegrityError:
                    self.stdout.write(
                        self.style.WARNING(f'Failed to create event for user: {user.username}')
                    )
                    continue
