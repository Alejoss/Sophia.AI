from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('knowledge_paths', '0010_path_funding_proposal'),
    ]

    operations = [
        migrations.AddField(
            model_name='pathproposal',
            name='contract_address',
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name='pathproposal',
            name='token_category',
            field=models.CharField(blank=True, max_length=64),
        ),
    ]
