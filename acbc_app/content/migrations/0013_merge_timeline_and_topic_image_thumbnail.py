# Merge parallel 0012 branches: topic timeline models + topic_image_thumbnail field

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0012_topic_timeline'),
        ('content', '0012_topic_topic_image_thumbnail'),
    ]

    operations = []
