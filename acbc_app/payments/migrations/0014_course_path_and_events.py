import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0002_event_is_visible'),
        ('knowledge_paths', '0008_published_knowledge_path_snapshot'),
        ('payments', '0013_course_purchase'),
    ]

    operations = [
        migrations.AddField(
            model_name='course',
            name='knowledge_path',
            field=models.ForeignKey(
                blank=True,
                help_text='Optional path whose missions belong to this course.',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='courses',
                to='knowledge_paths.knowledgepath',
            ),
        ),
        migrations.CreateModel(
            name='CourseEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('course', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='course_events',
                    to='payments.course',
                )),
                ('event', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='course_links',
                    to='events.event',
                )),
            ],
            options={
                'ordering': ['event__date_start', 'created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='courseevent',
            constraint=models.UniqueConstraint(fields=('course', 'event'), name='course_event_once'),
        ),
    ]
