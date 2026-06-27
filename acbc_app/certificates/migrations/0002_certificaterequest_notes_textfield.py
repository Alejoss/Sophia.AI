import json

from django.db import migrations, models


def _notes_to_text(raw):
    if not raw:
        return ''
    if isinstance(raw, str):
        return raw
    if isinstance(raw, dict):
        message = raw.get('message')
        if message is not None:
            return str(message)
        return json.dumps(raw, ensure_ascii=False)
    return str(raw)


def convert_json_notes_to_text(apps, schema_editor):
    CertificateRequest = apps.get_model('certificates', 'CertificateRequest')
    for request in CertificateRequest.objects.all().iterator():
        text = _notes_to_text(request.notes)
        if text != request.notes_text:
            request.notes_text = text
            request.save(update_fields=['notes_text'])


class Migration(migrations.Migration):

    dependencies = [
        ('certificates', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='certificaterequest',
            name='notes_text',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.RunPython(convert_json_notes_to_text, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='certificaterequest',
            name='notes',
        ),
        migrations.RenameField(
            model_name='certificaterequest',
            old_name='notes_text',
            new_name='notes',
        ),
        migrations.AlterField(
            model_name='certificaterequest',
            name='notes',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Optional message from the requester',
            ),
        ),
    ]
