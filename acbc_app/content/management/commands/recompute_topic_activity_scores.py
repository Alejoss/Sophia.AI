from django.core.management.base import BaseCommand

from content.topic_activity import recompute_all_topic_activity_scores, recompute_topic_activity_score


class Command(BaseCommand):
    help = (
        'Fully recompute Topic.activity_score from contents, likes, comments, and timeline. '
        'Run once after migrating activity_score, or to repair drift.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--topic-id',
            type=int,
            default=None,
            help='Recompute a single topic by id (default: all topics).',
        )

    def handle(self, *args, **options):
        topic_id = options.get('topic_id')
        if topic_id is not None:
            score = recompute_topic_activity_score(topic_id)
            if score is None:
                self.stderr.write(self.style.ERROR(f'Topic {topic_id} not found.'))
                return
            self.stdout.write(self.style.SUCCESS(
                f'Recomputed topic {topic_id}: activity_score={score}'
            ))
            return

        updated = recompute_all_topic_activity_scores()
        self.stdout.write(self.style.SUCCESS(
            f'Recomputed activity_score for {updated} topic(s).'
        ))
