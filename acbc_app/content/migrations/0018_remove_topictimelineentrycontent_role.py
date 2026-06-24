from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0017_remove_topictimelineentry_display_date'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='topictimelineentrycontent',
            name='role',
        ),
    ]
