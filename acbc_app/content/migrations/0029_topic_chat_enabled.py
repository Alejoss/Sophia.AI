from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0028_topicchatquery'),
    ]

    operations = [
        migrations.AddField(
            model_name='topic',
            name='chat_enabled',
            field=models.BooleanField(
                default=False,
                help_text='When true, the Conversar (RAG consultation) tab is visible on the topic page.',
            ),
        ),
    ]
