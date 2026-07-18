"""
Populate a Book Club with realistic demo data using existing Topics / Knowledge Paths.

Example:
  python manage.py populate_book_club
  python manage.py populate_book_club --slug el-secuestro-de-bitcoin --members 8
  python manage.py populate_book_club --path-id 1 --topic-id 1 --reset
"""

from __future__ import annotations

import random
from datetime import timedelta

from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from faker import Faker

from book_clubs.models import (
    BookClub,
    BookClubEvent,
    BookClubMissionRelease,
    BookClubMembership,
    BookClubStatus,
    DiscussionQuestion,
    DiscussionQuestionStatus,
)
from comments.models import Comment
from content.models import Topic
from events.models import Event
from knowledge_paths.models import KnowledgePath, Node
from profiles.models import Profile, UserNodeCompletion

fake = Faker('es_ES')

DEMO_USER_PREFIX = 'clubdemo_'
DEFAULT_PASSWORD = 'demo1234'

MISSION_BLUEPRINTS = [
    {
        'title': 'Capítulos 1–2: Orígenes',
        'description': 'Lee la introducción y anota tres ideas que te sorprendan.',
        'media_type': 'TEXT',
    },
    {
        'title': 'Capítulos 3–4: Confianza y custodia',
        'description': 'Reflexiona sobre quién controla el dinero en cada escena.',
        'media_type': 'TEXT',
    },
    {
        'title': 'Capítulos 5–6: El incidente',
        'description': 'Prepara una pregunta para el próximo directo.',
        'media_type': 'VIDEO',
    },
    {
        'title': 'Cierre del ciclo: síntesis',
        'description': 'Escribe un párrafo conectando el libro con un caso actual.',
        'media_type': 'TEXT',
    },
]

FORUM_OPEN = [
    '¿Qué escena del libro te hizo dudar más de “quién es el dueño” del dinero?',
    'Si tuvieras que explicarle Bitcoin a alguien sin jerga, ¿qué metáfora usarías?',
    '¿Dónde viste ingenua confianza en intermediarios? ¿Te pasó algo similar?',
]

FORUM_CLOSED = [
    'Tras la primera lectura: ¿qué pregunta te quedó abierta para el próximo encuentro?',
]

FORUM_DRAFT = [
    'Pregunta programada: ¿qué cambiarías en el diseño de custodia del caso del libro?',
]

INTRO_SNIPPETS = [
    'Diseño productos educativos y leo sobre dinero y poder.',
    'Programo en Python y estoy explorando cripto desde cero.',
    'Trabajo en periodismo tech; me interesa la historia cypherpunk.',
    'Estudio economía y quiero conectar teoría con casos reales.',
    'Hago comunidad en Telegram y acompaño clubs de lectura.',
    'Construyo herramientas open source en mi tiempo libre.',
]


class Command(BaseCommand):
    help = (
        'Rellena un Book Club con datos demo (miembros, presentaciones, misiones, '
        'foro, reuniones) reutilizando Topics y Knowledge Paths existentes.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--slug',
            default='el-secuestro-de-bitcoin',
            help='Slug del club (se crea/actualiza si hace falta).',
        )
        parser.add_argument('--title', default=None, help='Título si se crea el club.')
        parser.add_argument('--path-id', type=int, default=None)
        parser.add_argument('--topic-id', type=int, default=None)
        parser.add_argument(
            '--username',
            default='admin',
            help='Usuario staff que figura como created_by / anfitrión.',
        )
        parser.add_argument(
            '--members',
            type=int,
            default=8,
            help='Cantidad de usuarios demo (prefijo clubdemo_) a crear/usar.',
        )
        parser.add_argument(
            '--reset',
            action='store_true',
            help=(
                'Borra datos demo del club (preguntas/respuestas, vínculos de eventos demo, '
                'membresías demo y nodos demo del path) antes de volver a poblar.'
            ),
        )

    def handle(self, *args, **options):
        try:
            host = User.objects.get(username=options['username'])
        except User.DoesNotExist as exc:
            raise CommandError(
                f"Usuario '{options['username']}' no existe. "
                'Crea admin con create_admin o pasa --username.'
            ) from exc

        path = self._resolve_path(options['path_id'])
        topic = self._resolve_topic(options['topic_id'])

        with transaction.atomic():
            club = self._ensure_club(
                slug=options['slug'],
                title=options['title'],
                path=path,
                topic=topic,
                host=host,
            )
            if options['reset']:
                self._reset_club_demo(club, path)

            nodes = self._ensure_missions(path)
            self._ensure_mission_schedule(club, nodes)
            members = self._ensure_demo_users(options['members'])
            # Include existing real users so Comunidad / progreso se vean vivos.
            all_members = self._ensure_memberships(club, [host] + members)
            self._ensure_introductions(club, all_members)
            events = self._ensure_events(host)
            self._link_events(club, events)
            questions = self._ensure_forum(club, host, nodes, events)
            self._ensure_answers(questions, all_members)
            self._ensure_progress(path, nodes, all_members)

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Book club demo listo.'))
        self.stdout.write(f'  Club:  /club-de-lectura/{club.slug}')
        self.stdout.write(f'  Admin: /dashboard/book-clubs/{club.slug}/general')
        self.stdout.write(f'  Path:  #{path.id} {path.title} ({path.nodes.count()} misiones)')
        if topic:
            self.stdout.write(f'  Topic: #{topic.id} {topic.title}')
        self.stdout.write(
            f'  Demo users: {DEMO_USER_PREFIX}* / password {DEFAULT_PASSWORD}'
        )
        self.stdout.write(
            f'  Miembros: {club.memberships.count()} · '
            f'Presentados: {club.memberships.filter(intro_updated_at__isnull=False).count()} · '
            f'Preguntas: {club.discussion_questions.count()} · '
            f'Reuniones: {club.club_events.count()}'
        )

    def _resolve_path(self, path_id):
        if path_id:
            try:
                return KnowledgePath.objects.get(pk=path_id)
            except KnowledgePath.DoesNotExist as exc:
                raise CommandError(f'KnowledgePath {path_id} no encontrado.') from exc
        path = KnowledgePath.objects.order_by('id').first()
        if not path:
            raise CommandError(
                'No hay Knowledge Paths. Crea uno o corre populate_knowledge_paths.'
            )
        return path

    def _resolve_topic(self, topic_id):
        if topic_id:
            try:
                return Topic.objects.get(pk=topic_id)
            except Topic.DoesNotExist as exc:
                raise CommandError(f'Topic {topic_id} no encontrado.') from exc
        return Topic.objects.order_by('id').first()

    def _ensure_club(self, *, slug, title, path, topic, host):
        club = BookClub.objects.filter(slug=slug).first()
        now = timezone.now()
        defaults = {
            'title': title or (club.title if club else path.title),
            'description': (
                (club.description if club and club.description else None)
                or path.description
                or (
                    'Ciclo demo del club de lectura: misiones semanales, foro post-to-see, '
                    'comunidad con presentaciones e investigación del tema vinculado.'
                )
            ),
            'knowledge_path': path,
            'topic': topic,
            'status': BookClubStatus.ACTIVE,
            'created_by': host,
            'starts_at': now - timedelta(days=7),
            'ends_at': now + timedelta(days=45),
            'telegram_group_url': 'https://t.me/sophia_club_demo',
        }
        if club:
            for key, value in defaults.items():
                setattr(club, key, value)
            club.save()
            self.stdout.write(f'Actualizado club existente: {club.slug}')
        else:
            club = BookClub.objects.create(slug=slugify(slug)[:220], **defaults)
            self.stdout.write(f'Creado club: {club.slug}')
        return club

    def _reset_club_demo(self, club, path):
        self.stdout.write('Reset de datos demo del club…')
        dq_ct = ContentType.objects.get_for_model(DiscussionQuestion)
        question_ids = list(
            DiscussionQuestion.objects.filter(book_club=club).values_list('id', flat=True)
        )
        if question_ids:
            Comment.objects.filter(
                content_type=dq_ct, object_id__in=question_ids
            ).delete()
        DiscussionQuestion.objects.filter(book_club=club).delete()

        demo_event_ids = list(
            Event.objects.filter(title__startswith='[Demo Club]').values_list('id', flat=True)
        )
        BookClubEvent.objects.filter(book_club=club, event_id__in=demo_event_ids).delete()
        Event.objects.filter(id__in=demo_event_ids).delete()

        demo_users = User.objects.filter(username__startswith=DEMO_USER_PREFIX)
        BookClubMembership.objects.filter(book_club=club, user__in=demo_users).delete()
        UserNodeCompletion.objects.filter(
            knowledge_path=path, user__in=demo_users
        ).delete()

        # Only remove mission nodes that match our blueprint titles if the path
        # had none originally besides demos — safer: remove nodes with demo marker in description.
        Node.objects.filter(
            knowledge_path=path,
            description__startswith='[Demo Club]',
        ).delete()

    def _ensure_missions(self, path):
        existing = list(path.nodes.order_by('order'))
        if existing:
            self.stdout.write(f'Path ya tiene {len(existing)} misiones; se reutilizan.')
            return existing

        nodes = []
        for i, blueprint in enumerate(MISSION_BLUEPRINTS, start=1):
            node = Node.objects.create(
                knowledge_path=path,
                title=blueprint['title'],
                description=f"[Demo Club] {blueprint['description']}",
                order=i,
                media_type=blueprint['media_type'],
            )
            nodes.append(node)
            self.stdout.write(f'  Misión {i}: {node.title}')
        return nodes

    def _ensure_mission_schedule(self, club, nodes):
        if not nodes:
            return
        duration = (
            club.ends_at - club.starts_at
            if club.starts_at and club.ends_at
            else None
        )
        for index, node in enumerate(nodes):
            opens_at = None
            if index == 0:
                opens_at = club.starts_at or timezone.now()
            elif duration:
                opens_at = club.starts_at + (duration / len(nodes)) * index
            BookClubMissionRelease.objects.update_or_create(
                book_club=club,
                node=node,
                defaults={'opens_at': opens_at},
            )

    def _ensure_demo_users(self, count):
        users = []
        for i in range(1, count + 1):
            username = f'{DEMO_USER_PREFIX}{i:02d}'
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@example.com',
                    'first_name': fake.first_name(),
                    'last_name': fake.last_name(),
                },
            )
            if created:
                user.set_password(DEFAULT_PASSWORD)
                user.save()
                Profile.objects.create(
                    user=user,
                    profile_description='',
                    external_url='',
                )
                self.stdout.write(f'  Usuario demo: {username}')
            else:
                Profile.objects.get_or_create(user=user)
            users.append(user)
        return users

    def _ensure_memberships(self, club, users):
        members = []
        for user in users:
            membership, created = BookClubMembership.objects.get_or_create(
                book_club=club,
                user=user,
            )
            members.append(membership)
            if created:
                self.stdout.write(f'  Membresía: {user.username}')
        # Also enroll Vincent if present (real user in this env).
        vincent = User.objects.filter(username='Vincent').first()
        if vincent:
            membership, _ = BookClubMembership.objects.get_or_create(
                book_club=club, user=vincent
            )
            if membership not in members:
                members.append(membership)
        return members

    def _ensure_introductions(self, club, memberships):
        now = timezone.now()
        presented = 0
        for idx, membership in enumerate(memberships):
            # Leave ~20% without intro so admin "Sin presentación" is visible.
            if idx % 5 == 4:
                continue
            profile = Profile.objects.get_or_create(user=membership.user)[0]
            intro = INTRO_SNIPPETS[idx % len(INTRO_SNIPPETS)]
            social = f'https://x.com/{membership.user.username.lower()}'
            profile.profile_description = intro
            profile.external_url = social
            profile.save(update_fields=['profile_description', 'external_url'])
            membership.intro_description = intro
            membership.social_url = social
            membership.additional_url = ''
            membership.intro_updated_at = now - timedelta(hours=idx + 1)
            membership.save(
                update_fields=[
                    'intro_description',
                    'social_url',
                    'additional_url',
                    'intro_updated_at',
                ]
            )
            presented += 1
        self.stdout.write(f'Presentaciones: {presented}/{len(memberships)}')

    def _ensure_events(self, host):
        now = timezone.now()
        specs = [
            {
                'title': '[Demo Club] Kickoff en vivo',
                'description': 'Presentación del ciclo y reglas del foro.',
                'date_start': now + timedelta(days=3, hours=2),
                'date_end': now + timedelta(days=3, hours=3),
            },
            {
                'title': '[Demo Club] Directo mitad de ciclo',
                'description': 'Debate guiado sobre custodia y confianza.',
                'date_start': now + timedelta(days=14, hours=2),
                'date_end': now + timedelta(days=14, hours=3),
            },
            {
                'title': '[Demo Club] Cierre y síntesis',
                'description': 'Recap y próximas lecturas.',
                'date_start': now + timedelta(days=35, hours=2),
                'date_end': now + timedelta(days=35, hours=3),
            },
        ]
        events = []
        for spec in specs:
            event, created = Event.objects.get_or_create(
                title=spec['title'],
                defaults={
                    'owner': host,
                    'description': spec['description'],
                    'date_start': spec['date_start'],
                    'date_end': spec['date_end'],
                    'event_type': 'LIVE_MASTER_CLASS',
                    'platform': 'telegram',
                    'is_visible': True,
                    'schedule_description': 'Sesión online del club de lectura.',
                },
            )
            if not created:
                event.date_start = spec['date_start']
                event.date_end = spec['date_end']
                event.is_visible = True
                event.save(update_fields=['date_start', 'date_end', 'is_visible'])
            events.append(event)
        # Keep any pre-existing event (e.g. Historia Cypherpunk) available to link.
        extra = Event.objects.filter(deleted=False).exclude(
            title__startswith='[Demo Club]'
        ).order_by('-id')[:2]
        for event in extra:
            if event not in events:
                events.append(event)
        return events

    def _link_events(self, club, events):
        for event in events[:3]:
            BookClubEvent.objects.get_or_create(book_club=club, event=event)
        self.stdout.write(f'Reuniones vinculadas: {club.club_events.count()}')

    def _ensure_forum(self, club, host, nodes, events):
        questions = []
        order = 1
        node1 = nodes[0] if nodes else None
        node2 = nodes[1] if len(nodes) > 1 else None
        event1 = events[0] if events else None

        for body in FORUM_OPEN:
            q, _ = DiscussionQuestion.objects.get_or_create(
                book_club=club,
                body=body,
                defaults={
                    'status': DiscussionQuestionStatus.OPEN,
                    'order': order,
                    'node': node1 if order == 1 else node2,
                    'event': event1 if order == 2 else None,
                    'created_by': host,
                },
            )
            if q.status != DiscussionQuestionStatus.OPEN:
                q.status = DiscussionQuestionStatus.OPEN
                q.save(update_fields=['status', 'updated_at'])
            questions.append(q)
            order += 1

        for body in FORUM_CLOSED:
            q, _ = DiscussionQuestion.objects.get_or_create(
                book_club=club,
                body=body,
                defaults={
                    'status': DiscussionQuestionStatus.CLOSED,
                    'order': order,
                    'node': node1,
                    'created_by': host,
                    'closes_at': timezone.now() - timedelta(days=1),
                },
            )
            if q.status != DiscussionQuestionStatus.CLOSED:
                q.status = DiscussionQuestionStatus.CLOSED
                q.save(update_fields=['status', 'updated_at'])
            questions.append(q)
            order += 1

        for body in FORUM_DRAFT:
            q, _ = DiscussionQuestion.objects.get_or_create(
                book_club=club,
                body=body,
                defaults={
                    'status': DiscussionQuestionStatus.DRAFT,
                    'order': order,
                    'opens_at': timezone.now() + timedelta(days=5),
                    'created_by': host,
                },
            )
            questions.append(q)
            order += 1

        self.stdout.write(f'Preguntas del foro: {len(questions)}')
        return questions

    def _ensure_answers(self, questions, memberships):
        dq_ct = ContentType.objects.get_for_model(DiscussionQuestion)
        answer_bodies = [
            'Me pareció clave cómo la confianza ciega termina costando caro.',
            'Lo conecté con exchanges centralizados: misma lógica de custodia.',
            'Me dejó pensando en verificación propia antes de delegar.',
            'Creo que el libro exagera un poco, pero el alerta es útil.',
            'Mi takeaway: documentar procesos y no depender de un solo actor.',
        ]
        created = 0
        open_questions = [
            q for q in questions if q.status == DiscussionQuestionStatus.OPEN
        ]
        closed_questions = [
            q for q in questions if q.status == DiscussionQuestionStatus.CLOSED
        ]

        for question in open_questions + closed_questions:
            # 3–5 distinct members answer each open/closed question.
            authors = random.sample(
                memberships,
                k=min(len(memberships), random.randint(3, 5)),
            )
            for i, membership in enumerate(authors):
                exists = Comment.objects.filter(
                    content_type=dq_ct,
                    object_id=question.id,
                    author=membership.user,
                    parent=None,
                    is_active=True,
                ).exists()
                if exists:
                    continue
                comment = Comment.objects.create(
                    author=membership.user,
                    body=answer_bodies[i % len(answer_bodies)],
                    content_type=dq_ct,
                    object_id=question.id,
                    parent=None,
                )
                created += 1
                # One nested reply on the first answer for realism.
                if i == 0 and len(authors) > 1:
                    Comment.objects.get_or_create(
                        author=authors[1].user,
                        parent=comment,
                        defaults={
                            'body': 'Buen punto — ¿lo aplicarías también a wallets custodiales?',
                            'content_type': dq_ct,
                            'object_id': question.id,
                        },
                    )
        self.stdout.write(f'Respuestas nuevas en el foro: {created}')

    def _ensure_progress(self, path, nodes, memberships):
        if not nodes:
            return
        now = timezone.now()
        completions = 0
        for membership in memberships:
            # Staff/host and first half complete more missions.
            if membership.user.is_staff or membership.user.username.endswith('01'):
                target = nodes[:3]
            elif membership.user.username.endswith(('02', '03', '04')):
                target = nodes[:2]
            else:
                target = nodes[:1]
            for node in target:
                obj, created = UserNodeCompletion.objects.get_or_create(
                    user=membership.user,
                    knowledge_path=path,
                    node=node,
                    defaults={
                        'is_completed': True,
                        'completed_at': now - timedelta(days=random.randint(1, 6)),
                    },
                )
                if created:
                    completions += 1
                elif not obj.is_completed:
                    obj.is_completed = True
                    obj.completed_at = now
                    obj.save(update_fields=['is_completed', 'completed_at'])
                    completions += 1
        self.stdout.write(f'Progresos de misión actualizados: {completions}')
