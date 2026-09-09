from django.db import migrations, models


def enable_sales_for_existing(apps, schema_editor):
    Topic = apps.get_model('content', 'Topic')
    Topic.objects.update(sales_enabled=True)


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0039_merge_bch_payments_and_contentembedding'),
    ]

    operations = [
        migrations.RenameField(
            model_name='topic',
            old_name='bch_direct_enabled',
            new_name='sales_enabled',
        ),
        migrations.AlterField(
            model_name='topic',
            name='sales_enabled',
            field=models.BooleanField(
                default=True,
                help_text='Staff: allow buyers to purchase Consultas when the topic has a price.',
            ),
        ),
        migrations.RunPython(enable_sales_for_existing, migrations.RunPython.noop),
    ]
