# Downsized WebP for custom content profile thumbnails in lists/cards

from django.db import migrations, models
import content.models


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0013_merge_timeline_and_topic_image_thumbnail'),
    ]

    operations = [
        migrations.AddField(
            model_name='contentprofile',
            name='thumbnail_preview',
            field=models.ImageField(
                blank=True,
                null=True,
                max_length=255,
                upload_to=content.models.content_profile_thumbnail_preview_path,
                help_text='Auto-generated downsized thumbnail for list/card views.',
            ),
        ),
    ]
