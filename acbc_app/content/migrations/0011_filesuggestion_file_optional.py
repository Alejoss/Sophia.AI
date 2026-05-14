from django.db import migrations, models

import content.models


class Migration(migrations.Migration):
    dependencies = [
        ('content', '0010_collection_is_public'),
    ]

    operations = [
        migrations.AlterField(
            model_name='filesuggestion',
            name='file',
            field=models.FileField(
                blank=True,
                null=True,
                upload_to=content.models.file_suggestion_upload_path,
            ),
        ),
    ]
