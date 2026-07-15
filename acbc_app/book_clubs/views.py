from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from book_clubs.models import (
    BookClub,
    BookClubEvent,
    BookClubMembership,
    BookClubStatus,
    DiscussionQuestion,
    DiscussionQuestionStatus,
    MembershipRole,
)
from book_clubs.permissions import user_can_view_question
from book_clubs.serializers import (
    BookClubCreateUpdateSerializer,
    BookClubDetailSerializer,
    BookClubEventCreateSerializer,
    BookClubEventSerializer,
    BookClubListSerializer,
    BookClubMembershipSerializer,
    DiscussionQuestionSerializer,
    DiscussionQuestionWriteSerializer,
)
from comments.models import Comment
from knowledge_paths.services.node_user_activity_service import get_knowledge_path_progress
from profiles.models import UserNodeCompletion


def _get_club(slug):
    return get_object_or_404(
        BookClub.objects.select_related('knowledge_path', 'topic', 'created_by'),
        slug=slug,
    )


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


class BookClubListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        qs = BookClub.objects.select_related('knowledge_path', 'topic')
        # Non-staff only see active clubs, or clubs they belong to
        if not request.user.is_staff:
            qs = qs.filter(
                Q(status=BookClubStatus.ACTIVE)
                | Q(memberships__user=request.user)
            ).distinct()
        serializer = BookClubListSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
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
        if club.status == BookClubStatus.DRAFT and not request.user.is_staff:
            return Response(
                {'detail': 'This book club is not open yet.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        membership, created = BookClubMembership.objects.get_or_create(
            book_club=club,
            user=request.user,
            defaults={'role': MembershipRole.MEMBER},
        )
        return Response(
            {
                'created': created,
                'membership': BookClubMembershipSerializer(membership).data,
                'club': BookClubDetailSerializer(club, context={'request': request}).data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class BookClubHubView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        club = _get_club(slug)
        if not club.user_is_member(request.user) and club.status != BookClubStatus.ACTIVE:
            return Response({'detail': 'Join the club to view the hub.'}, status=status.HTTP_403_FORBIDDEN)
        # Allow peeking at active clubs to encourage join; membership required for full hub content
        is_member = club.user_is_member(request.user)

        progress = {
            'completed_nodes': 0,
            'total_nodes': club.knowledge_path.nodes.count() if club.knowledge_path_id else 0,
            'percentage': 0,
            'is_completed': False,
            'nodes_progress': [],
        }
        next_mission = None
        if is_member and club.knowledge_path_id:
            progress = get_knowledge_path_progress(request.user, club.knowledge_path)
            nodes_by_id = {
                n.id: n
                for n in club.knowledge_path.nodes.all()
            }
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
                # Fallback: first incomplete regardless of availability
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
                        }
                        break

        now = timezone.now()
        next_link = (
            BookClubEvent.objects.filter(book_club=club, event__deleted=False)
            .filter(Q(event__date_start__gte=now) | Q(event__date_start__isnull=True))
            .select_related('event')
            .order_by('event__date_start')
            .first()
        )
        # Prefer upcoming by date_start; if none, show most recent past for reference
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
        # Reload after possible status updates
        questions = list(
            DiscussionQuestion.objects.filter(book_club=club)
            .select_related('node', 'event', 'created_by')
            .order_by('order', 'created_at')
        )

        can_manage = club.user_can_manage(request.user)
        visible = []
        for q in questions:
            if q.status == DiscussionQuestionStatus.DRAFT and not can_manage:
                continue
            if not is_member and q.status == DiscussionQuestionStatus.DRAFT:
                continue
            visible.append(q)

        open_questions = [q for q in visible if q.status == DiscussionQuestionStatus.OPEN]
        past_questions = [q for q in visible if q.status == DiscussionQuestionStatus.CLOSED]
        # Mentors also see drafts in a separate light list folded into open for manage UX? Keep drafts out of open.
        draft_questions = (
            [q for q in visible if q.status == DiscussionQuestionStatus.DRAFT]
            if can_manage
            else []
        )

        recent_activity = []
        if is_member:
            ct_dq = ContentType.objects.get_for_model(DiscussionQuestion)
            dq_ids = [q.id for q in visible if q.status != DiscussionQuestionStatus.DRAFT]
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

        # Non-members of active clubs may peek at club meta / next event only;
        # question bodies, drafts, activity and event listings stay members-only.
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

        return Response(
            {
                'club': BookClubDetailSerializer(club, context={'request': request}).data,
                'is_member': is_member,
                'progress': progress_payload,
                'next_mission': next_mission if is_member else None,
                'next_event': next_event_data,
                'open_questions': DiscussionQuestionSerializer(
                    open_questions if is_member else [], many=True, context=question_ctx
                ).data,
                'past_questions': DiscussionQuestionSerializer(
                    past_questions if is_member else [], many=True, context=question_ctx
                ).data,
                'draft_questions': DiscussionQuestionSerializer(
                    draft_questions if is_member else [], many=True, context=question_ctx
                ).data,
                'recent_activity': recent_activity,
                'club_pulse': club_pulse if is_member else None,
                'quick_links': {
                    'knowledge_path_id': club.knowledge_path_id if is_member else None,
                    'topic_id': club.topic_id if is_member else None,
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
                    if is_member
                    else [],
                },
            }
        )


class BookClubEventListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        club = _get_club(slug)
        if not club.user_is_member(request.user):
            return Response(
                {'detail': 'Join the club to view events.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        links = (
            BookClubEvent.objects.filter(book_club=club, event__deleted=False)
            .select_related('event')
            .order_by('event__date_start')
        )
        return Response(BookClubEventSerializer(links, many=True).data)

    def post(self, request, slug):
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


class DiscussionQuestionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        club = _get_club(slug)
        if not club.user_is_member(request.user):
            return Response({'detail': 'Join the club to view questions.'}, status=status.HTTP_403_FORBIDDEN)

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
        status_filter = request.query_params.get('status')
        visible = []
        for q in qs:
            if not user_can_view_question(q, request.user):
                continue
            if status_filter and q.status != status_filter:
                continue
            visible.append(q)
        return Response(
            DiscussionQuestionSerializer(visible, many=True, context={'request': request}).data
        )

    def post(self, request, slug):
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
    permission_classes = [IsAuthenticated]

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
        if not user_can_view_question(question, request.user):
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        data = DiscussionQuestionSerializer(question, context={'request': request}).data
        data['can_answer'] = (
            club.user_is_member(request.user)
            and question.status == DiscussionQuestionStatus.OPEN
        )
        data['can_manage'] = club.user_can_manage(request.user)
        return Response(data)

    def patch(self, request, slug, pk):
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
        club, question = self.get_object(slug, pk)
        if not club.user_can_manage(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        question.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
