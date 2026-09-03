# Merge parallel content migration branches after merging main.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0037_topic_bch_payments'),
        ('content', '0038_contentembedding_and_move_bookkeeping'),
    ]

    operations = []
