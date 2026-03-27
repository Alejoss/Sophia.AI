from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0003_topic_topic_image_focal"),
    ]

    operations = [
        migrations.AddField(
            model_name="content",
            name="has_spanish_subtitles",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="content",
            name="has_spanish_dubbing",
            field=models.BooleanField(default=False),
        ),
    ]
