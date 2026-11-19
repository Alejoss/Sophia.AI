from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('knowledge_paths', '0011_path_proposal_contract'),
    ]

    operations = [
        migrations.AlterField(
            model_name='pathproposal',
            name='author_payout_address',
            field=models.CharField(blank=True, max_length=128),
        ),
    ]
