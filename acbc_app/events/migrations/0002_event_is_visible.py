from django.db import migrations, models


def set_existing_events_visible(apps, schema_editor):
    Event = apps.get_model('events', 'Event')
    Event.objects.all().update(is_visible=True)


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='is_visible',
            field=models.BooleanField(
                blank=True,
                default=False,
                help_text='Whether this event is visible to other users',
            ),
        ),
        migrations.RunPython(set_existing_events_visible, migrations.RunPython.noop),
    ]
