from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0004_content_spanish_accessibility_flags"),
    ]

    operations = [
        migrations.AddField(
            model_name="contentprofile",
            name="thumbnail",
            field=models.ImageField(
                upload_to="content.models.content_profile_thumbnail_upload_path",
                null=True,
                blank=True,
                max_length=255,
            ),
        ),
    ]

