from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.utils.text import slugify

from book_clubs.models import (
    BookClub,
    BookClubMembership,
    BookClubStatus,
    MembershipRole,
)
from content.models import Topic
from knowledge_paths.models import KnowledgePath


class Command(BaseCommand):
    help = (
        'Create or update a BookClub linked to an existing KnowledgePath '
        '(and optionally a Topic). Creator becomes club admin.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--title', required=True)
        parser.add_argument('--path-id', type=int, required=True)
        parser.add_argument('--topic-id', type=int, default=None)
        parser.add_argument('--slug', default=None)
        parser.add_argument('--username', default='admin')
        parser.add_argument(
            '--status',
            choices=[c.value for c in BookClubStatus],
            default=BookClubStatus.ACTIVE,
        )

    def handle(self, *args, **options):
        try:
            path = KnowledgePath.objects.get(pk=options['path_id'])
        except KnowledgePath.DoesNotExist as exc:
            raise CommandError(f"KnowledgePath {options['path_id']} not found") from exc

        topic = None
        if options['topic_id']:
            try:
                topic = Topic.objects.get(pk=options['topic_id'])
            except Topic.DoesNotExist as exc:
                raise CommandError(f"Topic {options['topic_id']} not found") from exc

        try:
            user = User.objects.get(username=options['username'])
        except User.DoesNotExist as exc:
            raise CommandError(f"User '{options['username']}' not found") from exc

        slug = options['slug'] or slugify(options['title'])[:220]
        club, created = BookClub.objects.update_or_create(
            slug=slug,
            defaults={
                'title': options['title'],
                'description': path.description or '',
                'knowledge_path': path,
                'topic': topic,
                'status': options['status'],
                'created_by': user,
                'starts_at': timezone.now(),
            },
        )
        BookClubMembership.objects.get_or_create(
            book_club=club,
            user=user,
            defaults={'role': MembershipRole.ADMIN},
        )
        action = 'Created' if created else 'Updated'
        self.stdout.write(
            self.style.SUCCESS(f'{action} book club "{club.slug}" (id={club.id})')
        )
