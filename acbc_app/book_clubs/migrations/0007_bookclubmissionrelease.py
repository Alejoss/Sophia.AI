from django.db import migrations, models
import django.db.models.deletion


def seed_existing_club_schedules(apps, schema_editor):
    BookClub = apps.get_model('book_clubs', 'BookClub')
    Release = apps.get_model('book_clubs', 'BookClubMissionRelease')
    Node = apps.get_model('knowledge_paths', 'Node')

    for club in BookClub.objects.exclude(knowledge_path_id=None):
        nodes = list(
            Node.objects.filter(knowledge_path_id=club.knowledge_path_id).order_by('order')
        )
        if not nodes:
            continue

        for index, node in enumerate(nodes):
            opens_at = None
            if index == 0:
                opens_at = club.starts_at or club.created_at
            elif club.starts_at and club.ends_at and len(nodes) > 1:
                interval = (club.ends_at - club.starts_at) / len(nodes)
                opens_at = club.starts_at + interval * index

            Release.objects.create(
                book_club_id=club.id,
                node_id=node.id,
                opens_at=opens_at,
            )


class Migration(migrations.Migration):
    dependencies = [
        ('book_clubs', '0006_remove_bookclubmembership_role'),
        ('knowledge_paths', '0003_knowledgepath_image_preview'),
    ]

    operations = [
        migrations.CreateModel(
            name='BookClubMissionRelease',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                (
                    'opens_at',
                    models.DateTimeField(
                        blank=True,
                        help_text='Null keeps the mission locked until staff schedules it.',
                        null=True,
                    ),
                ),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'book_club',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='mission_releases',
                        to='book_clubs.bookclub',
                    ),
                ),
                (
                    'node',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='book_club_releases',
                        to='knowledge_paths.node',
                    ),
                ),
            ],
            options={
                'ordering': ['node__order'],
            },
        ),
        migrations.AddConstraint(
            model_name='bookclubmissionrelease',
            constraint=models.UniqueConstraint(
                fields=('book_club', 'node'),
                name='unique_book_club_mission_release',
            ),
        ),
        migrations.RunPython(seed_existing_club_schedules, migrations.RunPython.noop),
    ]
