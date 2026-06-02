# Generated for auto-downsized topic cover used in listings

from django.db import migrations, models
import content.models


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0011_filesuggestion_file_optional'),
    ]

    operations = [
        migrations.AddField(
            model_name='topic',
            name='topic_image_thumbnail',
            field=models.ImageField(
                blank=True,
                null=True,
                max_length=255,
                upload_to=content.models.topic_image_thumbnail_path,
                help_text='Auto-generated downsized cover used in topic listings.',
            ),
        ),
    ]
