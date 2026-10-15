import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0044_unlimited_consultation_user'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TranscriptGenerationRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('price_amount', models.FloatField(default=1.0)),
                ('status', models.CharField(
                    choices=[
                        ('pending_payment', 'Pending payment'),
                        ('queued', 'Paid — queued for transcription'),
                        ('completed', 'Completed'),
                        ('cancelled', 'Cancelled'),
                    ],
                    db_index=True,
                    default='pending_payment',
                    max_length=32,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('content', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='transcript_generation_requests',
                    to='content.content',
                )),
                ('requester', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='transcript_generation_requests',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='transcriptgenerationrequest',
            index=models.Index(fields=['status', 'created_at'], name='transcript_gen_status_idx'),
        ),
        migrations.AddConstraint(
            model_name='transcriptgenerationrequest',
            constraint=models.UniqueConstraint(
                condition=models.Q(status__in=['pending_payment', 'queued']),
                fields=('content',),
                name='unique_open_transcript_generation',
            ),
        ),
    ]
