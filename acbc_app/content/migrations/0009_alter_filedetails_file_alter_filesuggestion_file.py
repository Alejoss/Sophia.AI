# Generated manually: FileField default max_length=100 was too short for S3 keys

import content.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0008_rename_content_file_content_58ff3f_idx_content_fil_content_32a911_idx_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='filedetails',
            name='file',
            field=models.FileField(
                blank=True,
                max_length=512,
                null=True,
                upload_to=content.models.content_file_upload_path,
            ),
        ),
        migrations.AlterField(
            model_name='filesuggestion',
            name='file',
            field=models.FileField(
                max_length=512,
                upload_to=content.models.file_suggestion_upload_path,
            ),
        ),
    ]
