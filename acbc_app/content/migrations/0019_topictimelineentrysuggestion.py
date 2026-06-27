from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('content', '0018_remove_topictimelineentrycontent_role'),
    ]

    operations = [
        migrations.CreateModel(
            name='TopicTimelineEntrySuggestion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('start_date', models.DateField(blank=True, null=True)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('message', models.TextField(blank=True)),
                ('rejection_reason', models.TextField(blank=True)),
                ('status', models.CharField(
                    choices=[('PENDING', 'Pending'), ('ACCEPTED', 'Accepted'), ('REJECTED', 'Rejected')],
                    default='PENDING',
                    max_length=10,
                )),
                ('is_duplicate', models.BooleanField(
                    default=False,
                    help_text='Si ya existe una entrada equivalente en la linea de tiempo.',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('accepted_entry', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='source_suggestions',
                    to='content.topictimelineentry',
                )),
                ('reviewed_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='reviewed_timeline_entry_suggestions',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('suggested_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='timeline_entry_suggestions',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('topic', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='timeline_entry_suggestions',
                    to='content.topic',
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='TopicTimelineEntrySuggestionContent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order', models.PositiveIntegerField(default=0)),
                ('caption', models.CharField(blank=True, max_length=255)),
                ('content', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='timeline_entry_suggestion_links',
                    to='content.content',
                )),
                ('suggestion', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='suggested_contents',
                    to='content.topictimelineentrysuggestion',
                )),
            ],
            options={
                'ordering': ['order', 'id'],
                'unique_together': {('suggestion', 'content')},
            },
        ),
        migrations.AddIndex(
            model_name='topictimelineentrysuggestion',
            index=models.Index(fields=['topic', 'status'], name='content_tl_sugg_topic_st_idx'),
        ),
        migrations.AddIndex(
            model_name='topictimelineentrysuggestion',
            index=models.Index(fields=['suggested_by', 'status'], name='content_tl_sugg_user_st_idx'),
        ),
    ]
