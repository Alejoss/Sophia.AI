"""Create an English draft campaign for the BLAZE demo.

The campaign stays a draft until a wallet opens it. No pledge is invented.

Example:
  python manage.py seed_path_funding_demo --username admin \\
    --address bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from knowledge_paths.models import Node
from knowledge_paths.services.proposal_service import ProposalError, create_draft


class Command(BaseCommand):
    help = 'Seed a draft knowledge-path funding campaign and one text lesson.'

    def add_arguments(self, parser):
        parser.add_argument('--username', required=True)
        parser.add_argument('--address', required=True, help='Author CashAddr with a prefix.')
        parser.add_argument('--goal', type=int, default=30000)
        parser.add_argument('--days', type=int, default=14)

    def handle(self, *args, **options):
        try:
            author = User.objects.get(username=options['username'])
        except User.DoesNotExist as exc:
            raise CommandError(f"No user named {options['username']}.") from exc
        deadline = timezone.now().replace(microsecond=0) + timedelta(days=options['days'])
        pitch = (
            'This path is funded in Bitcoin Cash. '
            f"The goal is {options['goal']} satoshis. "
            'One 10,000 satoshi pledge leaves the pool short. '
            'The pledge that reaches the goal closes refunds, and a missed deadline '
            'lets each supporter reclaim their pledge with the NFT.'
        )
        try:
            proposal = create_draft(
                author=author,
                title='Fund a knowledge path with Bitcoin Cash',
                pitch=pitch,
                goal_sats=options['goal'],
                deadline=deadline,
                author_payout_address=options['address'],
            )
        except ProposalError as exc:
            raise CommandError(str(exc)) from exc
        Node.objects.create(
            knowledge_path=proposal.knowledge_path,
            title='What this campaign funds',
            description=pitch,
            media_type='TEXT',
            order=1,
        )
        self.stdout.write(self.style.SUCCESS(
            f'Draft proposal {proposal.pk} for path {proposal.knowledge_path_id}.'
        ))
