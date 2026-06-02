import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('content', '0011_filesuggestion_file_optional'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TopicTimeline',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(blank=True, max_length=200)),
                ('description', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_topic_timelines', to=settings.AUTH_USER_MODEL)),
                ('topic', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='timeline', to='content.topic')),
            ],
        ),
        migrations.CreateModel(
            name='TopicTimelineEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('display_date', models.CharField(blank=True, help_text="Optional human-friendly label such as 'Before Bitcoin' or '1990s'.", max_length=100)),
                ('start_date', models.DateField(blank=True, null=True)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_topic_timeline_entries', to=settings.AUTH_USER_MODEL)),
                ('timeline', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='entries', to='content.topictimeline')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_topic_timeline_entries', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['order', 'start_date', 'created_at'],
            },
        ),
        migrations.CreateModel(
            name='TopicTimelineEntryContent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order', models.PositiveIntegerField(default=0)),
                ('role', models.CharField(choices=[('PRIMARY', 'Primary'), ('REFERENCE', 'Reference'), ('EXAMPLE', 'Example'), ('OPTIONAL', 'Optional')], default='REFERENCE', max_length=20)),
                ('caption', models.CharField(blank=True, max_length=255)),
                ('content', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='timeline_entry_links', to='content.content')),
                ('entry', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='entry_contents', to='content.topictimelineentry')),
            ],
            options={
                'ordering': ['order', 'id'],
                'unique_together': {('entry', 'content')},
            },
        ),
        migrations.AddIndex(
            model_name='topictimelineentry',
            index=models.Index(fields=['timeline', 'order'], name='content_tl_entry_order_idx'),
        ),
        migrations.AddIndex(
            model_name='topictimelineentrycontent',
            index=models.Index(fields=['entry', 'order'], name='content_tl_entry_content_idx'),
        ),
    ]
