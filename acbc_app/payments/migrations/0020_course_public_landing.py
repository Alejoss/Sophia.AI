from django.db import migrations, models


def publish_real_historia_landing(apps, schema_editor):
    Course = apps.get_model('payments', 'Course')
    Course.objects.filter(code='real-historia-bitcoin').update(public_landing=True)


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0019_transcript_generation_payment_targets'),
    ]

    operations = [
        migrations.AddField(
            model_name='course',
            name='public_landing',
            field=models.BooleanField(
                default=False,
                help_text=(
                    'This course has a public page at /cursos/{code}. '
                    'Event creators can attach a live event to that page.'
                ),
            ),
        ),
        migrations.RunPython(publish_real_historia_landing, migrations.RunPython.noop),
    ]
