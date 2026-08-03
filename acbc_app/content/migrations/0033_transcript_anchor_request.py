from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('content', '0032_transcript_anchor_default_signet'),
    ]

    operations = [
        migrations.CreateModel(
            name='TranscriptAnchorRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text_hash', models.CharField(help_text='SHA-256 hex digest snapshot at request time.', max_length=64)),
                ('text_length', models.PositiveIntegerField(blank=True, null=True)),
                ('price_amount', models.FloatField(default=1.0)),
                ('status', models.CharField(choices=[('pending_payment', 'Pending payment'), ('paid_pending_review', 'Paid — pending review'), ('approved', 'Approved (broadcast)'), ('rejected', 'Rejected')], db_index=True, default='pending_payment', max_length=32)),
                ('review_note', models.TextField(blank=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('anchor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='requests', to='content.transcriptanchor')),
                ('content', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transcript_anchor_requests', to='content.content')),
                ('requester', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transcript_anchor_requests', to=settings.AUTH_USER_MODEL)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_transcript_anchor_requests', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='transcriptanchorrequest',
            index=models.Index(fields=['status', 'created_at'], name='anchor_req_status_idx'),
        ),
        migrations.AddIndex(
            model_name='transcriptanchorrequest',
            index=models.Index(fields=['text_hash'], name='anchor_req_hash_idx'),
        ),
        migrations.AddConstraint(
            model_name='transcriptanchorrequest',
            constraint=models.UniqueConstraint(condition=models.Q(('status__in', ['pending_payment', 'paid_pending_review'])), fields=('text_hash',), name='unique_active_anchor_request_per_hash'),
        ),
    ]
