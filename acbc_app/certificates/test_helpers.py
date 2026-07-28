"""Shared helpers for certificate / knowledge-path completion tests."""

from django.utils import timezone

from content.models import Content, ContentProfile
from knowledge_paths.models import Node
from profiles.models import UserNodeCompletion


def ensure_path_completed(user, knowledge_path):
    """
    Ensure ``user`` has completed every node on ``knowledge_path``.

    Creates a single node if the path is empty. Nodes without quizzes are
    enough for ``is_knowledge_path_completed`` to return True.
    """
    nodes = list(knowledge_path.nodes.all())
    if not nodes:
        content = Content.objects.create(
            original_title=f'Content for {knowledge_path.title}',
            media_type='TEXT',
            uploaded_by=user,
        )
        content_profile = ContentProfile.objects.create(
            content=content,
            title=f'Profile for {knowledge_path.title}',
            user=user,
        )
        nodes = [
            Node.objects.create(
                knowledge_path=knowledge_path,
                content_profile=content_profile,
                title='Node 1',
                description='Required for certificate eligibility',
                order=1,
                media_type='TEXT',
            )
        ]

    for node in nodes:
        UserNodeCompletion.objects.update_or_create(
            user=user,
            knowledge_path=knowledge_path,
            node=node,
            defaults={
                'is_completed': True,
                'completed_at': timezone.now(),
            },
        )
    return nodes
