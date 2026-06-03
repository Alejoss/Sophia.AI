# Downsized WebP for knowledge path list cards

from django.db import migrations, models
import knowledge_paths.models


class Migration(migrations.Migration):

    dependencies = [
        ('knowledge_paths', '0002_knowledgepath_image_focal'),
    ]

    operations = [
        migrations.AddField(
            model_name='knowledgepath',
            name='image_preview',
            field=models.ImageField(
                blank=True,
                null=True,
                max_length=255,
                upload_to=knowledge_paths.models.knowledge_path_image_preview_path,
                help_text='Auto-generated downsized cover for list/card views.',
            ),
        ),
    ]
