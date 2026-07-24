# Generated manually for Collection.description

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0024_topic_activity_score'),
    ]

    operations = [
        migrations.AddField(
            model_name='collection',
            name='description',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Short description of the collection (max 300 characters).',
                max_length=300,
            ),
        ),
    ]
