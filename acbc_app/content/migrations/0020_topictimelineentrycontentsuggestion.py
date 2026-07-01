from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('content', '0019_topictimelineentrysuggestion'),
    ]

    operations = [
        migrations.CreateModel(
            name='TopicTimelineEntryContentSuggestion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('message', models.TextField(blank=True)),
                ('rejection_reason', models.TextField(blank=True)),
                ('status', models.CharField(
                    choices=[('PENDING', 'Pending'), ('ACCEPTED', 'Accepted'), ('REJECTED', 'Rejected')],
                    default='PENDING',
                    max_length=10,
                )),
                ('is_duplicate', models.BooleanField(
                    default=False,
                    help_text='Si el contenido ya esta vinculado a esta entrada.',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('content', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='timeline_entry_content_suggestions',
                    to='content.content',
                )),
                ('entry', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='content_link_suggestions',
                    to='content.topictimelineentry',
                )),
                ('reviewed_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='reviewed_timeline_entry_content_suggestions',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('suggested_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='timeline_entry_content_suggestions',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('topic', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='timeline_entry_content_suggestions',
                    to='content.topic',
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='topictimelineentrycontentsuggestion',
            index=models.Index(fields=['topic', 'status'], name='content_tl_ecs_topic_st_idx'),
        ),
        migrations.AddIndex(
            model_name='topictimelineentrycontentsuggestion',
            index=models.Index(fields=['entry', 'status'], name='content_tl_ecs_entry_st_idx'),
        ),
        migrations.AddIndex(
            model_name='topictimelineentrycontentsuggestion',
            index=models.Index(fields=['suggested_by', 'status'], name='content_tl_ecs_user_st_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='topictimelineentrycontentsuggestion',
            unique_together={('entry', 'content', 'suggested_by')},
        ),
    ]
