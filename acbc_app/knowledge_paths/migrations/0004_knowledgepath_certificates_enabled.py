from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('knowledge_paths', '0003_knowledgepath_image_preview'),
    ]

    operations = [
        migrations.AddField(
            model_name='knowledgepath',
            name='certificates_enabled',
            field=models.BooleanField(
                default=False,
                help_text='Whether learners can request a completion certificate for this path',
            ),
        ),
    ]
