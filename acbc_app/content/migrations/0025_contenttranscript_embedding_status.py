from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0024_topic_activity_score'),
    ]

    operations = [
        migrations.AddField(
            model_name='contenttranscript',
            name='chunk_count',
            field=models.PositiveIntegerField(
                blank=True,
                help_text='Number of chunks upserted to the vector DB on last successful index.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='contenttranscript',
            name='embedded_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When the vector DB was last successfully updated for this transcript.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='contenttranscript',
            name='embedded_text_hash',
            field=models.CharField(
                blank=True,
                help_text='text_hash that was indexed; compared to text_hash to detect stale.',
                max_length=64,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='contenttranscript',
            name='embedding_dims',
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text='Vector dimensions for embedding_model.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='contenttranscript',
            name='embedding_error',
            field=models.TextField(
                blank=True,
                help_text='Last embed-worker error message when status=failed.',
            ),
        ),
        migrations.AddField(
            model_name='contenttranscript',
            name='embedding_model',
            field=models.CharField(
                blank=True,
                help_text='Embedding model last used when status=indexed (set by embed worker ack).',
                max_length=64,
            ),
        ),
        migrations.AddField(
            model_name='contenttranscript',
            name='embedding_status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('indexed', 'Indexed'),
                    ('stale', 'Stale'),
                    ('failed', 'Failed'),
                    ('skipped', 'Skipped'),
                ],
                db_index=True,
                default='pending',
                help_text='Whether current text_hash is indexed in the external vector DB.',
                max_length=16,
            ),
        ),
        migrations.AddIndex(
            model_name='contenttranscript',
            index=models.Index(
                fields=['embedded_text_hash'],
                name='content_tr_emb_hash_idx',
            ),
        ),
    ]
