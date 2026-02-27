# Generated for focal point on knowledge path cover image (0-1, default 0.5)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('knowledge_paths', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='knowledgepath',
            name='image_focal_x',
            field=models.FloatField(blank=True, default=0.5),
        ),
        migrations.AddField(
            model_name='knowledgepath',
            name='image_focal_y',
            field=models.FloatField(blank=True, default=0.5),
        ),
    ]
