import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('content', '0021_topic_is_public'),
    ]

    operations = [
        migrations.CreateModel(
            name='TopicCreationRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('proposed_title', models.CharField(max_length=200)),
                ('proposed_description', models.TextField(blank=True)),
                ('approved_title', models.CharField(blank=True, max_length=200)),
                ('approved_description', models.TextField(blank=True)),
                ('status', models.CharField(
                    choices=[
                        ('PENDING', 'Pending'),
                        ('APPROVED', 'Approved'),
                        ('REJECTED', 'Rejected'),
                        ('COMPLETED', 'Completed'),
                    ],
                    default='PENDING',
                    max_length=10,
                )),
                ('rejection_reason', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('requested_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='topic_creation_requests',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('reviewed_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='reviewed_topic_creation_requests',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('topic', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='creation_request',
                    to='content.topic',
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='topiccreationrequest',
            index=models.Index(fields=['status'], name='content_tcr_status_idx'),
        ),
        migrations.AddIndex(
            model_name='topiccreationrequest',
            index=models.Index(fields=['requested_by', 'status'], name='content_tcr_user_status_idx'),
        ),
    ]
