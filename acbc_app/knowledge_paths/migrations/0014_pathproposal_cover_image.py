from django.db import migrations, models

import knowledge_paths.models


class Migration(migrations.Migration):

    dependencies = [
        ('knowledge_paths', '0013_pathproposal_path_optional'),
    ]

    operations = [
        migrations.AddField(
            model_name='pathproposal',
            name='image',
            field=models.ImageField(
                blank=True,
                help_text='Cover image for the crowdfunded investigation',
                max_length=255,
                null=True,
                upload_to=knowledge_paths.models.upload_proposal_image,
            ),
        ),
        migrations.AddField(
            model_name='pathproposal',
            name='image_preview',
            field=models.ImageField(
                blank=True,
                help_text='Auto-generated downsized cover for list/card views.',
                max_length=255,
                null=True,
                upload_to=knowledge_paths.models.proposal_image_preview_path,
            ),
        ),
        migrations.AddField(
            model_name='pathproposal',
            name='image_focal_x',
            field=models.FloatField(blank=True, default=0.5),
        ),
        migrations.AddField(
            model_name='pathproposal',
            name='image_focal_y',
            field=models.FloatField(blank=True, default=0.5),
        ),
    ]
