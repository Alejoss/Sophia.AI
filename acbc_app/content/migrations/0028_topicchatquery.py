import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('content', '0027_contentprofile_is_featured'),
    ]

    operations = [
        migrations.CreateModel(
            name='TopicChatQuery',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('question', models.TextField()),
                ('answer', models.TextField()),
                (
                    'sources',
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text='Citation payloads returned with the answer (index, content_id, excerpt, …).',
                    ),
                ),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'topic',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='chat_queries',
                        to='content.topic',
                    ),
                ),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='topic_chat_queries',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='topicchatquery',
            index=models.Index(
                fields=['topic', 'user', '-created_at'],
                name='content_tcq_topic_user_created',
            ),
        ),
    ]
