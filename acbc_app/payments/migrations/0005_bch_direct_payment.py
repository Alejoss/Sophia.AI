from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0033_transcript_anchor_request'),
        ('payments', '0004_cryptopayment_anchor_request'),
    ]

    operations = [
        migrations.CreateModel(
            name='BchDirectPayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('address', models.CharField(max_length=128)),
                ('expected_amount_sats', models.BigIntegerField(help_text='Exact amount in satoshis the payer must send.')),
                ('usd_amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('usd_bch_rate', models.DecimalField(decimal_places=6, help_text='USD per 1 BCH at order creation.', max_digits=18)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('paid', 'Paid'), ('expired', 'Expired'), ('cancelled', 'Cancelled')], db_index=True, default='pending', max_length=16)),
                ('expires_at', models.DateTimeField()),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
                ('payment_txid', models.CharField(blank=True, max_length=64, null=True, unique=True)),
                ('provider_payload', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('anchor_request', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bch_direct_payments', to='content.transcriptanchorrequest')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='bchdirectpayment',
            index=models.Index(fields=['status', 'expires_at'], name='bch_direct_status_exp_idx'),
        ),
        migrations.AddIndex(
            model_name='bchdirectpayment',
            index=models.Index(fields=['expected_amount_sats'], name='bch_direct_sats_idx'),
        ),
    ]
