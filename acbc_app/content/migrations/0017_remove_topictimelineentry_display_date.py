from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0016_contenttranscript'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='topictimelineentry',
            name='display_date',
        ),
    ]
