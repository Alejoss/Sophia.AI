from django.contrib.contenttypes.models import ContentType
from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.generics import get_object_or_404
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from book_clubs.emailing import send_book_club_invite_email
from book_clubs.guest_tokens import dump_guest_token, load_guest_token
from book_clubs.models import (
    BookClub,
    BookClubEvent,
    BookClubMissionRelease,
    BookClubMembership,
    BookClubStatus,
    DiscussionQuestion,
    DiscussionQuestionStatus,
)
from book_clubs.permissions import (
    user_can_answer_question,
    user_can_see_answers,
    user_can_view_question,
    user_has_answered,
)
from book_clubs.serializers import (
    BookClubCreateUpdateSerializer,
    BookClubDetailSerializer,
    BookClubEventCreateSerializer,
    BookClubEventSerializer,
    BookClubListSerializer,
    BookClubMemberIntroductionSerializer,
    BookClubMemberPublicSerializer,
    BookClubMembershipSerializer,
    DiscussionQuestionSerializer,
    DiscussionQuestionWriteSerializer,
)
from comments.models import Comment
from knowledge_paths.services.node_user_activity_service import get_knowledge_path_progress
from profiles.models import NewsletterSubscription, UserNodeCompletion


def _get_club(slug):
    return get_object_or_404(
        BookClub.objects.select_related('knowledge_path', 'topic', 'created_by'),
        slug=slug,
    )


def _guest_token_from_request(request):
    return (
        request.headers.get('X-Book-Club-Guest')
        or request.META.get('HTTP_X_BOOK_CLUB_GUEST')
        or ''
    ).strip()


def _resolve_guest_payload(request, slug):
    """Return (payload_dict|None|'expired'|'invalid', raw_token)."""
    token = _guest_token_from_request(request)
    if not token:
        return None, None
    try:
        payload = load_guest_token(token, expected_slug=slug)
        return payload, token
    except signing.SignatureExpired:
        return 'expired', token
    except signing.BadSignature:
        return 'invalid', token


def _sync_question_schedules(queryset):
    """Persist auto open/close transitions for questions with schedule fields."""
    now = timezone.now()
    to_update = []
    for question in queryset:
        if question.apply_schedule(now=now):
            to_update.append(question)
    if to_update:
        DiscussionQuestion.objects.bulk_update(to_update, ['status', 'updated_at'])
    return queryset


def _build_club_pulse(club, open_questions, member_ids):
    """Collective signals for the reading experience (not admin stats)."""
    member_count = len(member_ids)
    open_debates = len(open_questions)
    total_answers = 0
    if open_questions:
        ct = ContentType.objects.get_for_model(DiscussionQuestion)
        total_answers = Comment.objects.filter(
            content_type=ct,
            object_id__in=[q.id for q in open_questions],
            parent=None,
            is_active=True,
        ).count()

    first_mission_completions = 0
    active_readers_7d = 0
    path_completion_pct = 0
    if club.knowledge_path_id and member_ids:
        nodes = list(club.knowledge_path.nodes.order_by('order').values_list('id', 'order'))
        node_ids = [n[0] for n in nodes]
        if nodes:
            first_node_id = nodes[0][0]
            first_mission_completions = UserNodeCompletion.objects.filter(
                user_id__in=member_ids,
                node_id=first_node_id,
                is_completed=True,
            ).count()
            week_ago = timezone.now() - timezone.timedelta(days=7)
            active_readers_7d = (
                UserNodeCompletion.objects.filter(
                    user_id__in=member_ids,
                    node_id__in=node_ids,
                    is_completed=True,
                    completed_at__gte=week_ago,
                )
                .values('user_id')
                .distinct()
                .count()
            )
            # Average path completion across members (rough social pulse)
            total_nodes = len(node_ids)
            if total_nodes and member_count:
                completed_pairs = UserNodeCompletion.objects.filter(
                    user_id__in=member_ids,
                    node_id__in=node_ids,
                    is_completed=True,
                ).count()
                path_completion_pct = round(
                    (completed_pairs / (member_count * total_nodes)) * 100
                )

    return {
        'member_count': member_count,
        'active_readers_7d': active_readers_7d,
        'open_debates': open_debates,
        'total_answers': total_answers,
        'first_mission_completions': first_mission_completions,
        'path_completion_pct': path_completion_pct,
    }


class BookClubGuestAccessView(APIView):
    """Email gate: newsletter + signed guest token + invite email."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, slug):
        club = _get_club(slug)
        if club.status == BookClubStatus.CLOSED:
            return Response(
                {'detail': 'This book club is closed.', 'code': 'club_closed'},
                status=status.HTTP_403_FORBIDDEN,
            )

        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response(
                {'detail': 'El email es obligatorio.', 'code': 'email_required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response(
                {'detail': 'Email no válido.', 'code': 'invalid_email'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        source = f'club_de_lectura:{slug}'[:100]
        NewsletterSubscription.objects.get_or_create(
            email=email,
            defaults={'source': source},
        )

        guest_token = dump_guest_token(email=email, slug=club.slug)
        send_book_club_invite_email(email=email, club=club, token=guest_token)

        cover = None
        if club.cover_image:
            from content.utils import build_media_url

            cover = build_media_url(club.cover_image, request)

        return Response(
            {
                'guest_token': guest_token,
                'email': email,
                'club': {
                    'title': club.title,
                    'slug': club.slug,
                    'cover_image': cover,
                },
                'message': (
                    'Revisa tu correo para crear tu cuenta. '
                    'Mientras tanto ya puedes explorar el club.'
                ),
            },
            status=status.HTTP_201_CREATED,
        )


class BookClubInvitePreviewView(APIView):
    """Return email + club from invite token (for completar-cuenta page)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        token = (request.query_params.get('token') or '').strip()
        if not token:
            return Response(
                {'detail': 'Token requerido.', 'code': 'token_required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            payload = load_guest_token(token)
        except signing.SignatureExpired:
            return Response(
                {'detail': 'El enlace ha caducado.', 'code': 'token_expired'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except signing.BadSignature:
            return Response(
                {'detail': 'Enlace inválido.', 'code': 'token_invalid'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        club = BookClub.objects.filter(slug=payload['slug']).first()
        return Response(
            {
                'email': payload['email'],
                'slug': payload['slug'],
                'club_title': club.title if club else payload['slug'],
            }
        )


class BookClubListCreateView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        qs = BookClub.objects.select_related('knowledge_path', 'topic')
        if not request.user.is_authenticated:
            qs = qs.filter(status=BookClubStatus.ACTIVE)
        elif not request.user.is_staff:
            qs = qs.filter(
                Q(status=BookClubStatus.ACTIVE)
                | Q(memberships__user=request.user)
            ).distinct()
        serializer = BookClubListSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {'detail': 'Only staff can create book clubs.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = BookClubCreateUpdateSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        club = serializer.save()
        return Response(
            BookClubDetailSerializer(club, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class BookClubDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request, slug):
        club = _get_club(slug)
        if club.status == BookClubStatus.DRAFT and not club.user_can_manage(request.user):
            if not club.user_is_member(request.user):
                return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            BookClubDetailSerializer(club, context={'request': request}).data
        )

    def patch(self, request, slug):
        club = _get_club(slug)
        if not club.user_can_manage(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = BookClubCreateUpdateSerializer(
            club, data=request.data, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        club = serializer.save()
        return Response(
            BookClubDetailSerializer(club, context={'request': request}).data
        )


class BookClubJoinView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        club = _get_club(slug)
        if club.status == BookClubStatus.CLOSED:
            return Response(
                {'detail': 'This book club is closed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Draft and active clubs are open to join; closed is the only hard stop.
        membership, created = BookClubMembership.objects.get_or_create(
            book_club=club,
            user=request.user,
        )
        return Response(
            {
                'created': created,
                'membership': BookClubMembershipSerializer(membership).data,
                'club': BookClubDetailSerializer(club, context={'request': request}).data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class BookClubMemberIntroductionView(APIView):
    """Read or update the authenticated member's club-specific introduction."""

    permission_classes = [IsAuthenticated]

    def get_membership(self, request, slug):
        club = _get_club(slug)
        membership = BookClubMembership.objects.filter(
            book_club=club,
            user=request.user,
        ).first()
        return club, membership

    def get(self, request, slug):
        _club, membership = self.get_membership(request, slug)
        if not membership:
            return Response(
                {'detail': 'Debes unirte al club antes de presentarte.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(
            BookClubMemberIntroductionSerializer(membership).data
        )

    def patch(self, request, slug):
        _club, membership = self.get_membership(request, slug)
        if not membership:
            return Response(
                {'detail': 'Debes unirte al club antes de presentarte.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = BookClubMemberIntroductionSerializer(
            membership,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class BookClubMemberListView(APIView):
    """Member roster with club-specific introductions."""

    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        club = _get_club(slug)
        can_manage = club.user_can_manage(request.user)
        if not club.user_is_member(request.user) and not can_manage:
            return Response(
                {'detail': 'Debes ser miembro para ver la comunidad del club.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Public community: only members who completed "Preséntate".
        # Staff can pass ?include_all=1 to see everyone (including pending intros).
        include_all = (
            can_manage
            and request.query_params.get('include_all', '').lower() in ('1', 'true', 'yes')
        )
        memberships = club.memberships.select_related('user', 'user__profile').order_by(
            'joined_at'
        )
        if not include_all:
            memberships = memberships.filter(intro_updated_at__isnull=False)
        return Response(
            BookClubMemberPublicSerializer(
                memberships,
                many=True,
                context={'request': request},
            ).data
        )


class BookClubMissionScheduleView(APIView):
    """Staff-managed collective release dates for a club's missions."""

    permission_classes = [IsAuthenticated]

    def _club(self, request, slug):
        club = _get_club(slug)
        if not club.user_can_manage(request.user):
            return club, Response(
                {'detail': 'Solo el staff puede editar el calendario de misiones.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return club, None

    def _payload(self, club):
        if not club.knowledge_path_id:
            return []
        releases = {
            release.node_id: release
            for release in club.mission_releases.select_related('node')
        }
        now = timezone.now()
        payload = []
        nodes = club.knowledge_path.nodes.order_by('order')
        for index, node in enumerate(nodes):
            release = releases.get(node.id)
            opens_at = release.opens_at if release else (
                (club.starts_at or club.created_at) if index == 0 else None
            )
            is_released = bool(opens_at and opens_at <= now)
            payload.append({
                'node_id': node.id,
                'title': node.title,
                'order': node.order,
                'opens_at': opens_at,
                'is_released': is_released,
            })
        return payload

    def get(self, request, slug):
        club, denied = self._club(request, slug)
        if denied:
            return denied
        return Response(self._payload(club))

    def patch(self, request, slug):
        club, denied = self._club(request, slug)
        if denied:
            return denied
        if not club.knowledge_path_id:
            return Response(
                {'detail': 'El club no tiene un camino del conocimiento vinculado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        releases = request.data.get('releases')
        if not isinstance(releases, list):
            return Response(
                {'detail': 'Envía una lista en el campo releases.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        date_field = serializers.DateTimeField(allow_null=True)
        nodes = list(club.knowledge_path.nodes.order_by('order'))
        node_ids = {node.id for node in nodes}
        seen = set()
        normalized = []
        for item in releases:
            node_id = item.get('node_id') if isinstance(item, dict) else None
            if node_id not in node_ids or node_id in seen:
                return Response(
                    {'detail': 'El calendario contiene una misión inválida o duplicada.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            seen.add(node_id)
            try:
                opens_at = date_field.run_validation(item.get('opens_at'))
            except serializers.ValidationError as exc:
                return Response(
                    {'opens_at': exc.detail},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            normalized.append((node_id, opens_at))

        proposed = {
            release.node_id: release.opens_at
            for release in club.mission_releases.all()
        }
        if nodes and nodes[0].id not in proposed:
            proposed[nodes[0].id] = club.starts_at or club.created_at
        proposed.update(dict(normalized))
        dates_in_order = [proposed.get(node.id) for node in nodes]
        seen_unscheduled = False
        for opens_at in dates_in_order:
            if opens_at is None:
                seen_unscheduled = True
            elif seen_unscheduled:
                return Response(
                    {'detail': 'No puedes programar una misión si una anterior sigue sin fecha.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        dated = [opens_at for opens_at in dates_in_order if opens_at is not None]
        if dated != sorted(dated):
            return Response(
                {'detail': 'Las fechas deben avanzar en el mismo orden que las misiones.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            for node_id, opens_at in normalized:
                BookClubMissionRelease.objects.update_or_create(
                    book_club=club,
                    node_id=node_id,
                    defaults={'opens_at': opens_at},
                )

        return Response(self._payload(club))


class BookClubHubView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        club = _get_club(slug)
        user = request.user if request.user.is_authenticated else None
        is_staff = bool(user and (user.is_staff or user.is_superuser))
        is_member = bool(user and club.user_is_member(user))

        guest_result, _guest_token = _resolve_guest_payload(request, slug)
        if guest_result in ('expired', 'invalid'):
            return Response(
                {
                    'detail': 'Tu acceso de invitado ha caducado o es inválido. Introduce tu correo de nuevo.',
                    'code': 'guest_token_invalid',
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )
        is_guest = isinstance(guest_result, dict)

        if club.status == BookClubStatus.CLOSED and not is_member and not is_staff:
            return Response(
                {'detail': 'This book club is closed.', 'code': 'club_closed'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if is_staff and user and not is_member:
            BookClubMembership.objects.get_or_create(
                book_club=club,
                user=user,
            )
            is_member = True

        if not user and not is_guest:
            return Response(
                {
                    'detail': 'Introduce tu correo para entrar al club.',
                    'code': 'email_required',
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        can_participate = is_member
        # Guests and members see content; authenticated non-members get a redacted teaser
        # until the frontend joins them.
        can_view_content = is_member or is_guest

        progress = {
            'completed_nodes': 0,
            'total_nodes': club.knowledge_path.nodes.count() if club.knowledge_path_id else 0,
            'percentage': 0,
            'is_completed': False,
            'nodes_progress': [],
        }
        next_mission = None
        if is_member and club.knowledge_path_id:
            progress = get_knowledge_path_progress(
                user,
                club.knowledge_path,
                book_club=club,
            )
            nodes_by_id = {n.id: n for n in club.knowledge_path.nodes.all()}
            for node_data in progress.get('nodes_progress', []):
                if not node_data.get('is_completed') and node_data.get('is_available'):
                    node = nodes_by_id.get(node_data['node_id'])
                    next_mission = {
                        'node_id': node_data['node_id'],
                        'title': node_data['title'],
                        'order': node_data['order'],
                        'path_id': club.knowledge_path_id,
                        'description': (node.description or '') if node else '',
                        'locked': False,
                    }
                    break
            if next_mission is None:
                for node_data in progress.get('nodes_progress', []):
                    if not node_data.get('is_completed'):
                        node = nodes_by_id.get(node_data['node_id'])
                        next_mission = {
                            'node_id': node_data['node_id'],
                            'title': node_data['title'],
                            'order': node_data['order'],
                            'path_id': club.knowledge_path_id,
                            'description': (node.description or '') if node else '',
                            'locked': not node_data.get('is_available', False),
                            'club_schedule_locked': node_data.get(
                                'club_schedule_locked', False
                            ),
                            'opens_at': node_data.get('club_opens_at'),
                        }
                        break
        elif is_guest and club.knowledge_path_id:
            # Teaser: first mission of the path (no personal progress).
            first = club.knowledge_path.nodes.order_by('order').first()
            if first:
                next_mission = {
                    'node_id': first.id,
                    'title': first.title,
                    'order': first.order,
                    'path_id': club.knowledge_path_id,
                    'description': first.description or '',
                    'locked': True,
                    'teaser': True,
                }

        now = timezone.now()
        next_link = (
            BookClubEvent.objects.filter(book_club=club, event__deleted=False)
            .filter(Q(event__date_start__gte=now) | Q(event__date_start__isnull=True))
            .select_related('event')
            .order_by('event__date_start')
            .first()
        )
        if next_link is None:
            next_link = (
                BookClubEvent.objects.filter(book_club=club, event__deleted=False)
                .select_related('event')
                .order_by('-event__date_start')
                .first()
            )
            next_event_data = (
                BookClubEventSerializer(next_link).data if next_link else None
            )
            if next_event_data:
                next_event_data['is_past'] = True
        else:
            next_event_data = BookClubEventSerializer(next_link).data
            next_event_data['is_past'] = bool(
                next_link.event.date_start and next_link.event.date_start < now
            )

        questions = list(
            DiscussionQuestion.objects.filter(book_club=club)
            .select_related('node', 'event', 'created_by')
            .order_by('order', 'created_at')
        )
        _sync_question_schedules(questions)
        questions = list(
            DiscussionQuestion.objects.filter(book_club=club)
            .select_related('node', 'event', 'created_by')
            .order_by('order', 'created_at')
        )

        can_manage = bool(user and club.user_can_manage(user))
        visible = []
        for q in questions:
            if q.status == DiscussionQuestionStatus.DRAFT and not can_manage:
                continue
            visible.append(q)

        open_questions = [q for q in visible if q.status == DiscussionQuestionStatus.OPEN]
        past_questions = [q for q in visible if q.status == DiscussionQuestionStatus.CLOSED]
        draft_questions = (
            [q for q in visible if q.status == DiscussionQuestionStatus.DRAFT]
            if can_manage
            else []
        )

        recent_activity = []
        if can_view_content:
            ct_dq = ContentType.objects.get_for_model(DiscussionQuestion)
            dq_ids = [q.id for q in visible if q.status != DiscussionQuestionStatus.DRAFT]
            questions_by_id = {q.id: q for q in visible}
            dq_comments = (
                Comment.objects.filter(
                    content_type=ct_dq,
                    object_id__in=dq_ids,
                    parent=None,
                    is_active=True,
                )
                .select_related('author')
                .order_by('-created_at')[:8]
            )
            for c in dq_comments:
                question = questions_by_id.get(c.object_id)
                # Post-to-see: never leak answer previews until unlocked.
                if not question or not user or not user_can_see_answers(question, user):
                    continue
                recent_activity.append(
                    {
                        'type': 'discussion_answer',
                        'comment_id': c.id,
                        'author': c.author.username,
                        'body_preview': c.body[:120],
                        'discussion_question_id': c.object_id,
                        'created_at': c.created_at,
                    }
                )
            if club.topic_id:
                from content.models import Topic

                topic_ct = ContentType.objects.get_for_model(Topic)
                topic_comments = (
                    Comment.objects.filter(
                        content_type=topic_ct,
                        object_id=club.topic_id,
                        topic__isnull=True,
                        parent=None,
                        is_active=True,
                    )
                    .select_related('author')
                    .order_by('-created_at')[:5]
                )
                for c in topic_comments:
                    recent_activity.append(
                        {
                            'type': 'topic_comment',
                            'comment_id': c.id,
                            'author': c.author.username,
                            'body_preview': c.body[:120],
                            'topic_id': club.topic_id,
                            'created_at': c.created_at,
                        }
                    )
            recent_activity.sort(key=lambda x: x['created_at'], reverse=True)
            recent_activity = recent_activity[:10]

        question_ctx = {'request': request}
        member_ids = list(club.memberships.values_list('user_id', flat=True))
        club_pulse = _build_club_pulse(club, open_questions, member_ids)

        progress_payload = {
            'completed_nodes': progress.get('completed_nodes', 0),
            'total_nodes': progress.get('total_nodes', 0),
            'percentage': progress.get(
                'completion_percentage', progress.get('percentage', 0)
            ),
            'is_completed': progress.get('is_completed', False),
        }
        if is_member:
            progress_payload['nodes_progress'] = [
                {
                    'node_id': n.get('node_id'),
                    'title': n.get('title'),
                    'order': n.get('order'),
                    'is_completed': n.get('is_completed'),
                    'is_available': n.get('is_available'),
                }
                for n in progress.get('nodes_progress', [])
            ]

        show_lists = can_view_content
        return Response(
            {
                'club': BookClubDetailSerializer(club, context={'request': request}).data,
                'is_member': is_member,
                'is_guest': is_guest and not is_member,
                'can_participate': can_participate,
                'guest_email': guest_result.get('email') if is_guest and not is_member else None,
                'progress': progress_payload,
                'next_mission': next_mission if show_lists else None,
                'next_event': next_event_data,
                'open_questions': DiscussionQuestionSerializer(
                    open_questions if show_lists else [], many=True, context=question_ctx
                ).data,
                'past_questions': DiscussionQuestionSerializer(
                    past_questions if show_lists else [], many=True, context=question_ctx
                ).data,
                'draft_questions': DiscussionQuestionSerializer(
                    draft_questions if is_member else [], many=True, context=question_ctx
                ).data,
                'recent_activity': recent_activity,
                'club_pulse': club_pulse if show_lists else None,
                'quick_links': {
                    'knowledge_path_id': club.knowledge_path_id if is_member else None,
                    'topic_id': club.topic_id if show_lists else None,
                    'events': [
                        {
                            'event_id': link.event_id,
                            'title': link.event.title,
                            'date_start': link.event.date_start,
                        }
                        for link in BookClubEvent.objects.filter(book_club=club)
                        .select_related('event')
                        .order_by('event__date_start')
                    ]
                    if show_lists
                    else [],
                },
            }
        )


class BookClubEventListCreateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        club = _get_club(slug)
        user = request.user if request.user.is_authenticated else None
        is_member = bool(user and club.user_is_member(user))
        can_manage = bool(user and club.user_can_manage(user))
        guest_result, _ = _resolve_guest_payload(request, slug)
        if guest_result in ('expired', 'invalid'):
            return Response(
                {'detail': 'Guest token inválido.', 'code': 'guest_token_invalid'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        is_guest = isinstance(guest_result, dict)
        if not is_member and not is_guest and not can_manage:
            if user:
                return Response(
                    {'detail': 'Join the club to view events.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return Response(
                {'detail': 'Introduce tu correo para ver las reuniones.', 'code': 'email_required'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        links = (
            BookClubEvent.objects.filter(book_club=club, event__deleted=False)
            .select_related('event')
            .order_by('event__date_start')
        )
        return Response(BookClubEventSerializer(links, many=True).data)

    def post(self, request, slug):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        club = _get_club(slug)
        if not club.user_can_manage(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = BookClubEventCreateSerializer(
            data=request.data, context={'book_club': club, 'request': request}
        )
        serializer.is_valid(raise_exception=True)
        link = serializer.save()
        return Response(
            BookClubEventSerializer(link).data, status=status.HTTP_201_CREATED
        )

    def delete(self, request, slug):
        """Unlink an event from the club. Body: { "event_id": N }."""
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        club = _get_club(slug)
        if not club.user_can_manage(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        event_id = request.data.get('event_id')
        if not event_id:
            return Response(
                {'detail': 'event_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        deleted, _ = BookClubEvent.objects.filter(
            book_club=club, event_id=event_id
        ).delete()
        if not deleted:
            return Response(
                {'detail': 'Event link not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class BookClubEventUnlinkView(APIView):
    """DELETE a BookClubEvent link by its id (staff dashboard)."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, slug, pk):
        club = _get_club(slug)
        if not club.user_can_manage(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        link = get_object_or_404(BookClubEvent, pk=pk, book_club=club)
        link.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DiscussionQuestionListCreateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        club = _get_club(slug)
        user = request.user if request.user.is_authenticated else None
        is_member = bool(user and club.user_is_member(user))
        can_manage = bool(user and club.user_can_manage(user))
        guest_result, _ = _resolve_guest_payload(request, slug)
        if guest_result in ('expired', 'invalid'):
            return Response(
                {'detail': 'Guest token inválido.', 'code': 'guest_token_invalid'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        is_guest = isinstance(guest_result, dict)
        if not is_member and not is_guest and not can_manage:
            if user:
                return Response(
                    {'detail': 'Join the club to view discussion questions.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return Response(
                {'detail': 'Introduce tu correo para ver el foro.', 'code': 'email_required'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        qs = list(
            DiscussionQuestion.objects.filter(book_club=club)
            .select_related('node', 'event')
            .order_by('order', 'created_at')
        )
        _sync_question_schedules(qs)
        qs = list(
            DiscussionQuestion.objects.filter(book_club=club)
            .select_related('node', 'event')
            .order_by('order', 'created_at')
        )
        if not can_manage:
            qs = [q for q in qs if q.status != DiscussionQuestionStatus.DRAFT]
        return Response(
            DiscussionQuestionSerializer(qs, many=True, context={'request': request}).data
        )

    def post(self, request, slug):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        club = _get_club(slug)
        if not club.user_can_manage(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = DiscussionQuestionWriteSerializer(
            data=request.data, context={'request': request, 'book_club': club}
        )
        serializer.is_valid(raise_exception=True)
        question = serializer.save()
        return Response(
            DiscussionQuestionSerializer(question, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class DiscussionQuestionDetailView(APIView):
    permission_classes = [AllowAny]

    def get_object(self, slug, pk):
        club = _get_club(slug)
        question = get_object_or_404(
            DiscussionQuestion.objects.select_related('node', 'event', 'book_club'),
            pk=pk,
            book_club=club,
        )
        if question.apply_schedule():
            question.save(update_fields=['status', 'updated_at'])
        return club, question

    def get(self, request, slug, pk):
        club, question = self.get_object(slug, pk)
        user = request.user if request.user.is_authenticated else None
        is_member = bool(user and club.user_is_member(user))
        can_manage = bool(user and club.user_can_manage(user))
        guest_result, _ = _resolve_guest_payload(request, slug)
        if guest_result in ('expired', 'invalid'):
            return Response(
                {'detail': 'Guest token inválido.', 'code': 'guest_token_invalid'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        is_guest = isinstance(guest_result, dict)
        if not is_member and not is_guest and not can_manage:
            if user:
                return Response(
                    {'detail': 'Join the club to view this discussion.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return Response(
                {'detail': 'Introduce tu correo para ver este hilo del foro.', 'code': 'email_required'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if question.status == DiscussionQuestionStatus.DRAFT and not can_manage:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if user and not user_can_view_question(question, user) and not is_guest and not can_manage:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = DiscussionQuestionSerializer(question, context={'request': request}).data
        data['can_answer'] = bool(
            is_member and question.status == DiscussionQuestionStatus.OPEN
        )
        data['can_manage'] = bool(user and club.user_can_manage(user))
        data['has_answered'] = user_has_answered(question, user) if user else False
        data['can_see_answers'] = user_can_see_answers(question, user) if user else False
        return Response(data)

    def patch(self, request, slug, pk):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        club, question = self.get_object(slug, pk)
        if not club.user_can_manage(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = DiscussionQuestionWriteSerializer(
            question,
            data=request.data,
            partial=True,
            context={'request': request, 'book_club': club},
        )
        serializer.is_valid(raise_exception=True)
        question = serializer.save()
        return Response(
            DiscussionQuestionSerializer(question, context={'request': request}).data
        )

    def delete(self, request, slug, pk):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
        club, question = self.get_object(slug, pk)
        if not club.user_can_manage(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        question.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
