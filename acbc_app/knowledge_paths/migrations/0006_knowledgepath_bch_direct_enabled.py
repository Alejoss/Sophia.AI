from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('knowledge_paths', '0005_sell_knowledge_paths'),
    ]

    operations = [
        migrations.AddField(
            model_name='knowledgepath',
            name='bch_direct_enabled',
            field=models.BooleanField(
                default=False,
                help_text='Staff: offer self-custody Bitcoin Cash checkout for this paid path.',
            ),
        ),
    ]
