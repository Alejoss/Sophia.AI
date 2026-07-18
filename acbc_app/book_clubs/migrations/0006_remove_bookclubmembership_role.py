from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('book_clubs', '0005_topic_investigacion_help_text'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='bookclubmembership',
            name='role',
        ),
    ]
