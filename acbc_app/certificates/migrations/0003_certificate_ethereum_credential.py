from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('certificates', '0002_certificaterequest_notes_textfield'),
    ]

    operations = [
        migrations.AddField(
            model_name='certificate',
            name='credential_canonical',
            field=models.TextField(blank=True, default='', help_text='Exact JCS JSON committed by credential_digest'),
        ),
        migrations.AddField(
            model_name='certificate',
            name='credential_digest',
            field=models.CharField(blank=True, default='', help_text='SHA-256 hex of the frozen credential canonical JSON', max_length=64),
        ),
        migrations.AddField(
            model_name='certificate',
            name='credential_uri',
            field=models.TextField(blank=True, default='', help_text='URI stored on the credential registry for the frozen artifact'),
        ),
        migrations.AddField(
            model_name='certificate',
            name='ethereum_error',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='certificate',
            name='ethereum_recipient',
            field=models.CharField(blank=True, default='', help_text='Checksummed wallet that received or will receive the soulbound credential', max_length=42),
        ),
        migrations.AddField(
            model_name='certificate',
            name='ethereum_status',
            field=models.CharField(blank=True, default='', help_text='minted or failed. The chain read is the source of truth after a receipt.', max_length=16),
        ),
        migrations.AddField(
            model_name='certificate',
            name='ethereum_token_id',
            field=models.PositiveBigIntegerField(blank=True, help_text='ERC-721 token id on the credential registry, once minted', null=True),
        ),
    ]
