from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0015_remove_filedetails_text_analysis_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='ContentTranscript',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('parsed_plain', models.TextField(blank=True, help_text='Post-SRT plain text before spaCy (worker: parsed_plain).')),
                ('processed_plain', models.TextField(blank=True, help_text='spaCy-cleaned plain text; primary source for hash and future RAG.')),
                ('obsidian_markdown', models.TextField(blank=True, help_text='Obsidian note: YAML frontmatter + processed body.')),
                ('obsidian_frontmatter', models.JSONField(blank=True, default=dict, help_text='Parsed YAML frontmatter from obsidian_markdown.')),
                ('source_subtitles', models.TextField(blank=True, help_text='Optional raw SRT/VTT in memory for timed segments (not required by worker).')),
                ('format', models.CharField(choices=[('SRT', 'SubRip (.srt)'), ('VTT', 'WebVTT (.vtt)')], default='SRT', max_length=3)),
                ('segments', models.JSONField(blank=True, default=list, help_text='Parsed cues from source_subtitles: index, start_ms, end_ms, text.')),
                ('text_length', models.PositiveIntegerField(blank=True, null=True)),
                ('text_hash', models.CharField(blank=True, help_text='SHA-256 of normalized processed_plain (fallback: parsed_plain / Obsidian body).', max_length=64, null=True)),
                ('language', models.CharField(blank=True, help_text='ISO 639-1 language code, e.g. es or en.', max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('content', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='transcript', to='content.content')),
            ],
            options={
                'indexes': [
                    models.Index(fields=['text_hash'], name='content_transcript_hash_idx'),
                    models.Index(fields=['language'], name='content_transcript_lang_idx'),
                ],
            },
        ),
    ]
