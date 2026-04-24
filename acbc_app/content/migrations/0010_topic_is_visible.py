from django.db import migrations, models
from django.db.models import Count


def forwards_set_topic_visibility(apps, schema_editor):
    Topic = apps.get_model("content", "Topic")
    qs = Topic.objects.annotate(_n=Count("contents"))
    for topic in qs.iterator(chunk_size=500):
        topic.is_visible = topic._n >= 3
        topic.save(update_fields=["is_visible"])


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0009_alter_filedetails_file_max_length"),
    ]

    operations = [
        migrations.AddField(
            model_name="topic",
            name="is_visible",
            field=models.BooleanField(
                default=False,
                help_text="Whether this topic appears in public listings and search. Hidden topics remain accessible by direct link to creator and moderators.",
            ),
        ),
        migrations.RunPython(forwards_set_topic_visibility, migrations.RunPython.noop),
    ]
