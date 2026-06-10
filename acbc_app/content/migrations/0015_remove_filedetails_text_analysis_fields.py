from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0014_contentprofile_thumbnail_preview'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='filedetails',
            name='extracted_text',
        ),
        migrations.RemoveField(
            model_name='filedetails',
            name='text_length',
        ),
        migrations.RemoveField(
            model_name='filedetails',
            name='text_hash',
        ),
    ]
