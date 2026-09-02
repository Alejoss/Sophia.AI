from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0035_alter_topic_chat_enabled_help_text'),
    ]

    operations = [
        migrations.AddField(
            model_name='topicchatquery',
            name='retrieved_chunk_count',
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text='Chunks after score filter / dedupe / keyword fallback, before context budget.',
            ),
        ),
        migrations.AddField(
            model_name='topicchatquery',
            name='used_chunk_count',
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text='Chunks that fit wholly in the prompt context budget.',
            ),
        ),
    ]
