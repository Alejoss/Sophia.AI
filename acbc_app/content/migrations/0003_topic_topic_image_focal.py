# Generated for focal point on topic cover image (0-1, default 0.5)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0002_file_size_bigint'),
    ]

    operations = [
        migrations.AddField(
            model_name='topic',
            name='topic_image_focal_x',
            field=models.FloatField(blank=True, default=0.5),
        ),
        migrations.AddField(
            model_name='topic',
            name='topic_image_focal_y',
            field=models.FloatField(blank=True, default=0.5),
        ),
    ]
