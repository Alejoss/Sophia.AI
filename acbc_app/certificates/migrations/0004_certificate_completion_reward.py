from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('certificates', '0003_certificate_ethereum_credential'),
    ]

    operations = [
        migrations.AddField(
            model_name='certificate',
            name='reward_error',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='certificate',
            name='reward_recipient',
            field=models.CharField(blank=True, default='', help_text='Wallet that received the transferable completion reward', max_length=42),
        ),
        migrations.AddField(
            model_name='certificate',
            name='reward_status',
            field=models.CharField(blank=True, default='', max_length=16),
        ),
        migrations.AddField(
            model_name='certificate',
            name='reward_token_id',
            field=models.PositiveBigIntegerField(blank=True, help_text='ERC-721 token id on the completion reward contract', null=True),
        ),
        migrations.AddField(
            model_name='certificate',
            name='reward_tx_hash',
            field=models.CharField(blank=True, default='', max_length=80),
        ),
    ]
