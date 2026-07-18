"""
Tests for the Book Club Hub, membership, and DiscussionQuestions.
"""
import unittest.mock

from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from book_clubs.models import (
    BookClub,
    BookClubEvent,
    BookClubMembership,
    BookClubStatus,
    DiscussionQuestion,
    DiscussionQuestionStatus,
    MembershipRole,
)
from comments.models import Comment
from content.models import Topic
from events.models import Event
from knowledge_paths.models import KnowledgePath, Node


class BookClubAPITestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='clubadmin', password='pass123', is_staff=True
        )
        self.mentor = User.objects.create_user(username='mentor', password='pass123')
        self.member = User.objects.create_user(username='member', password='pass123')
        self.outsider = User.objects.create_user(username='outsider', password='pass123')

        self.path = KnowledgePath.objects.create(
            title='Cypherpunk Book',
            description='Read the book',
            author=self.admin,
            is_visible=True,
        )
        self.node1 = Node.objects.create(
            knowledge_path=self.path,
            title='Capítulos 1-3',
            description='Misión 1',
            order=1,
            media_type='TEXT',
        )
        self.node2 = Node.objects.create(
            knowledge_path=self.path,
            title='Capítulos 4-6',
            description='Misión 2',
            order=2,
            media_type='TEXT',
        )
        self.topic = Topic.objects.create(
            title='Club Topic',
            description='Community',
            creator=self.admin,
            is_public=True,
        )
        self.event = Event.objects.create(
            title='Directo 1',
            description='Live session',
            owner=self.admin,
            date_start=timezone.now() + timezone.timedelta(days=2),
            is_visible=True,
            event_type='LIVE_MASTER_CLASS',
        )
        self.club = BookClub.objects.create(
            title='Club de Lectura Cypherpunk',
            slug='cypherpunk',
            description='Primer ciclo',
            knowledge_path=self.path,
            topic=self.topic,
            status=BookClubStatus.ACTIVE,
            created_by=self.admin,
            starts_at=timezone.now() - timezone.timedelta(days=1),
            ends_at=timezone.now() + timezone.timedelta(days=60),
        )
        BookClubMembership.objects.create(
            book_club=self.club, user=self.admin, role=MembershipRole.ADMIN
        )
        BookClubMembership.objects.create(
            book_club=self.club, user=self.mentor, role=MembershipRole.MENTOR
        )
        BookClubEvent.objects.create(book_club=self.club, event=self.event)

    def auth(self, user):
        token = RefreshToken.for_user(user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_join_club(self):
        self.auth(self.member)
        response = self.client.post('/api/book_clubs/cypherpunk/join/')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            BookClubMembership.objects.filter(
                book_club=self.club, user=self.member
            ).exists()
        )
        # Idempotent
        response2 = self.client.post('/api/book_clubs/cypherpunk/join/')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)

    def test_member_can_save_introduction_and_view_roster(self):
        from profiles.models import Profile

        membership = BookClubMembership.objects.create(
            book_club=self.club,
            user=self.member,
            role=MembershipRole.MEMBER,
        )
        # Prefill comes from Profile when present.
        Profile.objects.create(
            user=self.member,
            profile_description='Ya tenía bio en mi perfil.',
            external_url='https://example.com/me',
        )
        self.auth(self.member)

        prefill = self.client.get('/api/book_clubs/cypherpunk/membership/introduction/')
        self.assertEqual(prefill.status_code, status.HTTP_200_OK, prefill.data)
        self.assertEqual(prefill.data['intro_description'], 'Ya tenía bio en mi perfil.')
        self.assertEqual(prefill.data['social_url'], 'https://example.com/me')
        self.assertTrue(prefill.data['sourced_from_profile'])

        empty_roster = self.client.get('/api/book_clubs/cypherpunk/members/')
        self.assertEqual(empty_roster.status_code, status.HTTP_200_OK, empty_roster.data)
        self.assertEqual(empty_roster.data, [])

        update = self.client.patch(
            '/api/book_clubs/cypherpunk/membership/introduction/',
            {
                'intro_description': 'Construyo productos educativos.',
                'social_url': 'linkedin.com/in/member',
                'additional_url': 'https://member.example.com',
            },
            format='json',
        )
        self.assertEqual(update.status_code, status.HTTP_200_OK, update.data)
        membership.refresh_from_db()
        profile = Profile.objects.get(user=self.member)
        self.assertEqual(profile.profile_description, 'Construyo productos educativos.')
        self.assertEqual(profile.external_url, 'https://linkedin.com/in/member')
        self.assertEqual(membership.additional_url, 'https://member.example.com')
        self.assertIsNotNone(membership.intro_updated_at)
        self.assertTrue(membership.has_introduced)

        roster = self.client.get('/api/book_clubs/cypherpunk/members/')
        self.assertEqual(roster.status_code, status.HTTP_200_OK, roster.data)
        self.assertEqual(len(roster.data), 1)
        own = roster.data[0]
        self.assertEqual(own['user_id'], self.member.id)
        self.assertEqual(own['intro_description'], profile.profile_description)
        self.assertEqual(own['social_url'], profile.external_url)
        self.assertTrue(own['has_introduced'])
        self.assertTrue(own['is_me'])
        self.assertFalse(
            any(item['user_id'] == self.admin.id for item in roster.data)
        )

    def test_non_member_cannot_edit_introduction_or_view_roster(self):
        self.auth(self.outsider)
        update = self.client.patch(
            '/api/book_clubs/cypherpunk/membership/introduction/',
            {'intro_description': 'No soy miembro.'},
            format='json',
        )
        self.assertEqual(update.status_code, status.HTTP_403_FORBIDDEN)
        roster = self.client.get('/api/book_clubs/cypherpunk/members/')
        self.assertEqual(roster.status_code, status.HTTP_403_FORBIDDEN)

    def test_hub_requires_auth(self):
        response = self.client.get('/api/book_clubs/cypherpunk/hub/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_hub_payload_for_member(self):
        BookClubMembership.objects.create(
            book_club=self.club, user=self.member, role=MembershipRole.MEMBER
        )
        self.auth(self.member)
        response = self.client.get('/api/book_clubs/cypherpunk/hub/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data['club']['slug'], 'cypherpunk')
        self.assertTrue(data['is_member'])
        self.assertEqual(data['progress']['total_nodes'], 2)
        self.assertIsNotNone(data['next_mission'])
        self.assertEqual(data['next_mission']['order'], 1)
        self.assertIsNotNone(data['next_event'])
        self.assertEqual(data['next_event']['event_id'], self.event.id)
        self.assertEqual(data['quick_links']['knowledge_path_id'], self.path.id)
        self.assertEqual(data['quick_links']['topic_id'], self.topic.id)

    def test_discussion_question_crud_and_comments(self):
        BookClubMembership.objects.create(
            book_club=self.club, user=self.member, role=MembershipRole.MEMBER
        )
        self.auth(self.mentor)
        create = self.client.post(
            '/api/book_clubs/cypherpunk/discussion-questions/',
            {
                'body': '¿Qué idea de los primeros capítulos te sorprendió más?',
                'node': self.node1.id,
                'order': 1,
                'status': DiscussionQuestionStatus.OPEN,
            },
            format='json',
        )
        self.assertEqual(create.status_code, status.HTTP_201_CREATED)
        qid = create.data['id']
        self.assertEqual(create.data['mission_label'], 'Misión 1: Capítulos 1-3')
        self.assertEqual(create.data['status'], 'open')

        # Member sees it on hub
        self.auth(self.member)
        hub = self.client.get('/api/book_clubs/cypherpunk/hub/')
        self.assertEqual(len(hub.data['open_questions']), 1)

        # Member answers
        answer = self.client.post(
            f'/api/comments/discussion-question/{qid}/',
            {'body': 'Me sorprendió la tesis sobre captura institucional.'},
            format='json',
        )
        self.assertEqual(answer.status_code, status.HTTP_201_CREATED)

        # Second top-level blocked
        answer2 = self.client.post(
            f'/api/comments/discussion-question/{qid}/',
            {'body': 'Otra respuesta'},
            format='json',
        )
        self.assertEqual(answer2.status_code, status.HTTP_400_BAD_REQUEST)

        # Outsider cannot answer
        self.auth(self.outsider)
        denied = self.client.post(
            f'/api/comments/discussion-question/{qid}/',
            {'body': 'No debería'},
            format='json',
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        # Close question → appears in past
        self.auth(self.mentor)
        closed = self.client.patch(
            f'/api/book_clubs/cypherpunk/discussion-questions/{qid}/',
            {'status': DiscussionQuestionStatus.CLOSED},
            format='json',
        )
        self.assertEqual(closed.status_code, status.HTTP_200_OK)

        self.auth(self.member)
        hub2 = self.client.get('/api/book_clubs/cypherpunk/hub/')
        self.assertEqual(len(hub2.data['open_questions']), 0)
        self.assertEqual(len(hub2.data['past_questions']), 1)
        self.assertEqual(hub2.data['past_questions'][0]['answer_count'], 1)

        # Past answers still readable
        listing = self.client.get(f'/api/comments/discussion-question/{qid}/')
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(len(listing.data), 1)

        # Cannot answer closed
        blocked = self.client.post(
            f'/api/comments/discussion-question/{qid}/',
            {'body': 'tarde'},
            format='json',
        )
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)

    def test_schedule_auto_open(self):
        BookClubMembership.objects.create(
            book_club=self.club, user=self.member, role=MembershipRole.MEMBER
        )
        q = DiscussionQuestion.objects.create(
            book_club=self.club,
            node=self.node1,
            body='Pregunta programada',
            status=DiscussionQuestionStatus.DRAFT,
            opens_at=timezone.now() - timezone.timedelta(minutes=5),
            created_by=self.mentor,
            order=2,
        )
        self.auth(self.member)
        hub = self.client.get('/api/book_clubs/cypherpunk/hub/')
        self.assertEqual(len(hub.data['open_questions']), 1)
        q.refresh_from_db()
        self.assertEqual(q.status, DiscussionQuestionStatus.OPEN)

    def test_member_cannot_create_question(self):
        BookClubMembership.objects.create(
            book_club=self.club, user=self.member, role=MembershipRole.MEMBER
        )
        self.auth(self.member)
        response = self.client.post(
            '/api/book_clubs/cypherpunk/discussion-questions/',
            {'body': 'No debería', 'status': 'open'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_link_event(self):
        event2 = Event.objects.create(
            title='Directo 2',
            owner=self.admin,
            date_start=timezone.now() + timezone.timedelta(days=10),
            is_visible=True,
        )
        self.auth(self.mentor)
        response = self.client.post(
            '/api/book_clubs/cypherpunk/events/',
            {'event_id': event2.id},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(BookClubEvent.objects.filter(book_club=self.club).count(), 2)

    def test_unlink_event_and_admin_member_management(self):
        membership = BookClubMembership.objects.create(
            book_club=self.club, user=self.member, role=MembershipRole.MEMBER
        )
        self.auth(self.mentor)

        # Public roster empty until presentation
        public_roster = self.client.get('/api/book_clubs/cypherpunk/members/')
        self.assertEqual(public_roster.status_code, status.HTTP_200_OK)
        self.assertEqual(public_roster.data, [])

        # Admin roster includes everyone
        admin_roster = self.client.get(
            '/api/book_clubs/cypherpunk/members/', {'include_all': 1}
        )
        self.assertEqual(admin_roster.status_code, status.HTTP_200_OK)
        ids = {item['user_id'] for item in admin_roster.data}
        self.assertIn(self.member.id, ids)
        self.assertIn(self.admin.id, ids)

        role_update = self.client.patch(
            f'/api/book_clubs/cypherpunk/members/{membership.id}/',
            {'role': MembershipRole.MENTOR},
            format='json',
        )
        self.assertEqual(role_update.status_code, status.HTTP_200_OK, role_update.data)
        membership.refresh_from_db()
        self.assertEqual(membership.role, MembershipRole.MENTOR)

        unlink = self.client.delete(
            '/api/book_clubs/cypherpunk/events/',
            {'event_id': self.event.id},
            format='json',
        )
        self.assertEqual(unlink.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            BookClubEvent.objects.filter(book_club=self.club, event=self.event).exists()
        )

        # Plain member cannot change roles; include_all is ignored without manage perms.
        reader = User.objects.create_user(username='reader', password='pass123')
        reader_membership = BookClubMembership.objects.create(
            book_club=self.club, user=reader, role=MembershipRole.MEMBER
        )
        self.auth(reader)
        public_as_reader = self.client.get(
            '/api/book_clubs/cypherpunk/members/', {'include_all': 1}
        )
        self.assertEqual(public_as_reader.status_code, status.HTTP_200_OK)
        self.assertEqual(public_as_reader.data, [])
        denied_role = self.client.patch(
            f'/api/book_clubs/cypherpunk/members/{reader_membership.id}/',
            {'role': MembershipRole.ADMIN},
            format='json',
        )
        self.assertEqual(denied_role.status_code, status.HTTP_403_FORBIDDEN)

    def test_unlink_event_by_link_id(self):
        link = BookClubEvent.objects.get(book_club=self.club, event=self.event)
        self.auth(self.mentor)
        response = self.client.delete(f'/api/book_clubs/cypherpunk/events/{link.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(BookClubEvent.objects.filter(pk=link.id).exists())

    def test_staff_can_list_events_without_membership(self):
        staff = User.objects.create_user(
            username='dashboardstaff', password='pass123', is_staff=True
        )
        self.auth(staff)
        response = self.client.get('/api/book_clubs/cypherpunk/events/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_staff_can_list_questions_without_membership(self):
        DiscussionQuestion.objects.create(
            book_club=self.club,
            body='¿Hilo del foro?',
            status=DiscussionQuestionStatus.OPEN,
            created_by=self.mentor,
            order=1,
        )
        staff = User.objects.create_user(
            username='forumstaff', password='pass123', is_staff=True
        )
        self.auth(staff)
        response = self.client.get('/api/book_clubs/cypherpunk/discussion-questions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def _open_question_with_member_answer(self):
        BookClubMembership.objects.create(
            book_club=self.club, user=self.member, role=MembershipRole.MEMBER
        )
        question = DiscussionQuestion.objects.create(
            book_club=self.club,
            node=self.node1,
            body='¿Pregunta abierta?',
            status=DiscussionQuestionStatus.OPEN,
            created_by=self.mentor,
            order=1,
        )
        dq_type = ContentType.objects.get_for_model(DiscussionQuestion)
        answer = Comment.objects.create(
            author=self.member,
            body='Respuesta del miembro',
            content_type=dq_type,
            object_id=question.id,
            parent=None,
        )
        return question, answer

    def test_outsider_cannot_reply_via_generic_endpoint(self):
        question, answer = self._open_question_with_member_answer()
        self.auth(self.outsider)
        response = self.client.post(
            f'/api/comments/replies/{answer.id}/',
            {'body': 'Respuesta de forastero'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            Comment.objects.filter(parent=answer, author=self.outsider).exists()
        )

    def test_member_can_reply_via_generic_endpoint(self):
        question, answer = self._open_question_with_member_answer()
        other = User.objects.create_user(username='member2', password='pass123')
        BookClubMembership.objects.create(
            book_club=self.club, user=other, role=MembershipRole.MEMBER
        )
        self.auth(other)
        # Post-to-see: must answer before reading/replying to others.
        locked = self.client.post(
            f'/api/comments/replies/{answer.id}/',
            {'body': 'Buen punto'},
            format='json',
        )
        self.assertEqual(locked.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(locked.data.get('code'), 'answer_required')

        own = self.client.post(
            f'/api/comments/discussion-question/{question.id}/',
            {'body': 'Mi respuesta primero'},
            format='json',
        )
        self.assertEqual(own.status_code, status.HTTP_201_CREATED)
        response = self.client.post(
            f'/api/comments/replies/{answer.id}/',
            {'body': 'Buen punto'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Comment.objects.filter(parent=answer, author=other).exists())

    def test_forum_post_to_see_answers(self):
        BookClubMembership.objects.create(
            book_club=self.club, user=self.member, role=MembershipRole.MEMBER
        )
        other = User.objects.create_user(username='member2', password='pass123')
        BookClubMembership.objects.create(
            book_club=self.club, user=other, role=MembershipRole.MEMBER
        )
        question = DiscussionQuestion.objects.create(
            book_club=self.club,
            node=self.node1,
            body='¿Pregunta del foro?',
            status=DiscussionQuestionStatus.OPEN,
            created_by=self.mentor,
            order=1,
        )
        dq_type = ContentType.objects.get_for_model(DiscussionQuestion)
        Comment.objects.create(
            author=self.member,
            body='Respuesta secreta del miembro',
            content_type=dq_type,
            object_id=question.id,
            parent=None,
        )

        # Other member cannot list answers until they post.
        self.auth(other)
        locked = self.client.get(f'/api/comments/discussion-question/{question.id}/')
        self.assertEqual(locked.status_code, status.HTTP_200_OK)
        self.assertEqual(locked.data, [])

        detail = self.client.get(
            f'/api/book_clubs/cypherpunk/discussion-questions/{question.id}/'
        )
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertFalse(detail.data['can_see_answers'])
        self.assertFalse(detail.data['has_answered'])
        self.assertIsNone(detail.data['answer_count'])

        hub = self.client.get('/api/book_clubs/cypherpunk/hub/')
        self.assertFalse(
            any(
                item.get('type') == 'discussion_answer'
                and 'secreta' in (item.get('body_preview') or '')
                for item in hub.data.get('recent_activity', [])
            )
        )

        # After answering, they unlock the thread.
        posted = self.client.post(
            f'/api/comments/discussion-question/{question.id}/',
            {'body': 'Ya respondí yo también'},
            format='json',
        )
        self.assertEqual(posted.status_code, status.HTTP_201_CREATED)
        unlocked = self.client.get(f'/api/comments/discussion-question/{question.id}/')
        self.assertEqual(unlocked.status_code, status.HTTP_200_OK)
        self.assertEqual(len(unlocked.data), 2)
        detail2 = self.client.get(
            f'/api/book_clubs/cypherpunk/discussion-questions/{question.id}/'
        )
        self.assertTrue(detail2.data['can_see_answers'])
        self.assertEqual(detail2.data['answer_count'], 2)

        # Soft-delete own answer re-locks.
        Comment.objects.logic_delete(
            Comment.objects.get(author=other, object_id=question.id, parent=None)
        )
        relocked = self.client.get(f'/api/comments/discussion-question/{question.id}/')
        self.assertEqual(relocked.status_code, status.HTTP_200_OK)
        self.assertEqual(relocked.data, [])
        detail3 = self.client.get(
            f'/api/book_clubs/cypherpunk/discussion-questions/{question.id}/'
        )
        self.assertFalse(detail3.data['can_see_answers'])
        self.assertIsNone(detail3.data['answer_count'])

        # Mentor sees all without answering.
        self.auth(self.mentor)
        mentor_list = self.client.get(
            f'/api/comments/discussion-question/{question.id}/'
        )
        self.assertEqual(mentor_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mentor_list.data), 1)
        mentor_detail = self.client.get(
            f'/api/book_clubs/cypherpunk/discussion-questions/{question.id}/'
        )
        self.assertTrue(mentor_detail.data['can_see_answers'])
        self.assertFalse(mentor_detail.data['has_answered'])

    def test_closed_question_blocks_generic_reply(self):
        question, answer = self._open_question_with_member_answer()
        question.status = DiscussionQuestionStatus.CLOSED
        question.save(update_fields=['status', 'updated_at'])

        self.auth(self.mentor)
        response = self.client.post(
            f'/api/comments/replies/{answer.id}/',
            {'body': 'tarde para responder'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_outsider_cannot_list_replies_on_discussion(self):
        question, answer = self._open_question_with_member_answer()
        Comment.objects.create(
            author=self.mentor,
            body='Reply interno',
            content_type=answer.content_type,
            object_id=answer.object_id,
            parent=answer,
        )
        self.auth(self.outsider)
        response = self.client.get(f'/api/comments/replies/{answer.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_hub_redacts_questions_for_non_members(self):
        DiscussionQuestion.objects.create(
            book_club=self.club,
            node=self.node1,
            body='Secreto del club',
            status=DiscussionQuestionStatus.OPEN,
            created_by=self.mentor,
            order=1,
        )
        self.auth(self.outsider)
        response = self.client.get('/api/book_clubs/cypherpunk/hub/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_member'])
        self.assertEqual(response.data['open_questions'], [])
        self.assertEqual(response.data['past_questions'], [])
        self.assertEqual(response.data['draft_questions'], [])
        self.assertIsNone(response.data['quick_links']['knowledge_path_id'])
        self.assertEqual(response.data['quick_links']['events'], [])

    def test_events_list_requires_membership(self):
        self.auth(self.outsider)
        denied = self.client.get('/api/book_clubs/cypherpunk/events/')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        BookClubMembership.objects.create(
            book_club=self.club, user=self.member, role=MembershipRole.MEMBER
        )
        self.auth(self.member)
        ok = self.client.get('/api/book_clubs/cypherpunk/events/')
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertEqual(len(ok.data), 1)


class BookClubCreateUpdateAPITestCase(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            username='staffuser', password='pass123', is_staff=True
        )
        self.member = User.objects.create_user(username='regular', password='pass123')

    def auth(self, user):
        token = RefreshToken.for_user(user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_non_staff_cannot_create(self):
        self.auth(self.member)
        response = self.client.post(
            '/api/book_clubs/',
            {'title': 'Club ilegal'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_can_create_without_path_or_slug(self):
        self.auth(self.staff)
        before = KnowledgePath.objects.count()
        response = self.client.post(
            '/api/book_clubs/',
            {
                'title': 'Cypherpunk sin path',
                'description': 'Se crea el path solo',
                'status': 'draft',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(response.data['slug'])
        self.assertIsNotNone(response.data['knowledge_path'])
        self.assertEqual(KnowledgePath.objects.count(), before + 1)
        club = BookClub.objects.get(slug=response.data['slug'])
        self.assertEqual(club.created_by_id, self.staff.id)
        self.assertTrue(
            BookClubMembership.objects.filter(
                book_club=club, user=self.staff, role=MembershipRole.ADMIN
            ).exists()
        )

    def test_staff_can_patch_status(self):
        self.auth(self.staff)
        created = self.client.post(
            '/api/book_clubs/',
            {'title': 'Club editable', 'status': 'draft'},
            format='json',
        )
        slug = created.data['slug']
        response = self.client.patch(
            f'/api/book_clubs/{slug}/',
            {'status': 'active', 'description': 'Actualizado'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['status'], 'active')
        self.assertEqual(response.data['description'], 'Actualizado')

    def test_staff_can_clear_telegram_and_dates(self):
        self.auth(self.staff)
        created = self.client.post(
            '/api/book_clubs/',
            {
                'title': 'Club con fechas',
                'status': 'draft',
                'telegram_group_url': 'https://t.me/ejemplo',
                'starts_at': timezone.now().isoformat(),
                'ends_at': (timezone.now() + timezone.timedelta(days=30)).isoformat(),
            },
            format='json',
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        slug = created.data['slug']
        self.assertTrue(created.data['telegram_group_url'])
        self.assertIsNotNone(created.data['starts_at'])

        cleared = self.client.patch(
            f'/api/book_clubs/{slug}/',
            {
                'telegram_group_url': '',
                'starts_at': None,
                'ends_at': None,
            },
            format='json',
        )
        self.assertEqual(cleared.status_code, status.HTTP_200_OK, cleared.data)
        self.assertEqual(cleared.data['telegram_group_url'], '')
        self.assertIsNone(cleared.data['starts_at'])
        self.assertIsNone(cleared.data['ends_at'])


class BookClubGuestOnboardingTests(BookClubAPITestCase):
    """Guest email gate, read-only hub, and complete-from-invite."""

    @unittest.mock.patch('book_clubs.views.send_book_club_invite_email', return_value=True)
    def test_guest_access_creates_subscription_and_token(self, mock_email):
        from profiles.models import NewsletterSubscription

        response = self.client.post(
            '/api/book_clubs/cypherpunk/guest-access/',
            {'email': 'lector@example.com'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn('guest_token', response.data)
        self.assertEqual(response.data['email'], 'lector@example.com')
        self.assertTrue(
            NewsletterSubscription.objects.filter(email='lector@example.com').exists()
        )
        mock_email.assert_called_once()
        self.assertEqual(mock_email.call_args.kwargs['email'], 'lector@example.com')

    def test_hub_requires_email_without_guest_or_auth(self):
        response = self.client.get('/api/book_clubs/cypherpunk/hub/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data.get('code'), 'email_required')

    @unittest.mock.patch('book_clubs.views.send_book_club_invite_email', return_value=True)
    def test_hub_guest_is_read_only(self, _mock_email):
        guest = self.client.post(
            '/api/book_clubs/cypherpunk/guest-access/',
            {'email': 'guest@example.com'},
            format='json',
        )
        token = guest.data['guest_token']
        response = self.client.get(
            '/api/book_clubs/cypherpunk/hub/',
            HTTP_X_BOOK_CLUB_GUEST=token,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data['is_guest'])
        self.assertFalse(response.data['is_member'])
        self.assertFalse(response.data['can_participate'])
        self.assertEqual(response.data['guest_email'], 'guest@example.com')
        self.assertIn('club', response.data)
        self.assertIn('progress', response.data)

    def test_hub_member_can_participate(self):
        BookClubMembership.objects.create(
            book_club=self.club, user=self.member, role=MembershipRole.MEMBER
        )
        self.auth(self.member)
        response = self.client.get('/api/book_clubs/cypherpunk/hub/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data['is_member'])
        self.assertTrue(response.data['can_participate'])
        self.assertFalse(response.data.get('is_guest'))

    def test_invite_preview_and_complete_from_invite(self):
        from book_clubs.guest_tokens import dump_guest_token

        token = dump_guest_token(email='nuevo@example.com', slug='cypherpunk')
        preview = self.client.get('/api/book_clubs/invite-preview/', {'token': token})
        self.assertEqual(preview.status_code, status.HTTP_200_OK, preview.data)
        self.assertEqual(preview.data['email'], 'nuevo@example.com')
        self.assertEqual(preview.data['slug'], 'cypherpunk')

        response = self.client.post(
            '/api/profiles/complete-from-invite/',
            {
                'token': token,
                'username': 'nuevolector',
                'password': 'testpass123',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn('access_token', response.data)
        self.assertEqual(response.data['club_slug'], 'cypherpunk')
        user = User.objects.get(username='nuevolector')
        self.assertEqual(user.email, 'nuevo@example.com')
        self.assertTrue(
            BookClubMembership.objects.filter(
                book_club=self.club, user=user
            ).exists()
        )

    def test_complete_from_invite_email_exists(self):
        from book_clubs.guest_tokens import dump_guest_token

        User.objects.create_user(
            username='yaexiste',
            email='yaexiste@example.com',
            password='testpass123',
        )
        token = dump_guest_token(email='yaexiste@example.com', slug='cypherpunk')
        response = self.client.post(
            '/api/profiles/complete-from-invite/',
            {
                'token': token,
                'username': 'otrouser',
                'password': 'testpass123',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('code'), 'email_exists')

    def test_guest_token_slug_mismatch_rejected_on_hub(self):
        from book_clubs.guest_tokens import dump_guest_token

        token = dump_guest_token(email='mismatch@example.com', slug='otro-club')
        response = self.client.get(
            '/api/book_clubs/cypherpunk/hub/',
            HTTP_X_BOOK_CLUB_GUEST=token,
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data.get('code'), 'guest_token_invalid')

    def test_anonymous_can_list_active_clubs(self):
        response = self.client.get('/api/book_clubs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [c['slug'] for c in response.data]
        self.assertIn('cypherpunk', slugs)

