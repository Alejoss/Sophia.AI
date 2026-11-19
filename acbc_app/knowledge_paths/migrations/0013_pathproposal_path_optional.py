import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('knowledge_paths', '0012_pathproposal_payout_optional'),
    ]

    operations = [
        migrations.AlterField(
            model_name='pathproposal',
            name='knowledge_path',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='funding_proposal',
                to='knowledge_paths.knowledgepath',
            ),
        ),
    ]
