from django.db import migrations, models


def enable_sales_for_existing(apps, schema_editor):
    """
    Former bch_direct_enabled=False still allowed NOWPayments sales.
    After rename, keep every existing product purchasable by default.
    """
    KnowledgePath = apps.get_model('knowledge_paths', 'KnowledgePath')
    KnowledgePath.objects.update(sales_enabled=True)


class Migration(migrations.Migration):

    dependencies = [
        ('knowledge_paths', '0006_knowledgepath_bch_direct_enabled'),
    ]

    operations = [
        migrations.RenameField(
            model_name='knowledgepath',
            old_name='bch_direct_enabled',
            new_name='sales_enabled',
        ),
        migrations.AlterField(
            model_name='knowledgepath',
            name='sales_enabled',
            field=models.BooleanField(
                default=True,
                help_text='Staff: allow buyers to purchase this path when it has a price.',
            ),
        ),
        migrations.RunPython(enable_sales_for_existing, migrations.RunPython.noop),
    ]
