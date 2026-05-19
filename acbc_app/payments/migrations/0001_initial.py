import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('events', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='CryptoPayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order_id', models.CharField(max_length=128, unique=True)),
                ('nowpayments_payment_id', models.BigIntegerField(blank=True, db_index=True, null=True)),
                ('pay_currency', models.CharField(choices=[('bch', 'Bitcoin Cash'), ('xmr', 'Monero')], max_length=10)),
                ('price_amount', models.FloatField()),
                ('price_currency', models.CharField(default='usd', max_length=10)),
                ('pay_amount', models.DecimalField(blank=True, decimal_places=12, max_digits=24, null=True)),
                ('pay_address', models.CharField(blank=True, max_length=256)),
                ('payment_status', models.CharField(choices=[('waiting', 'Waiting'), ('confirming', 'Confirming'), ('confirmed', 'Confirmed'), ('sending', 'Sending'), ('partially_paid', 'Partially paid'), ('finished', 'Finished'), ('failed', 'Failed'), ('refunded', 'Refunded'), ('expired', 'Expired')], default='waiting', max_length=32)),
                ('invoice_url', models.URLField(blank=True, max_length=512)),
                ('actually_paid', models.DecimalField(blank=True, decimal_places=12, max_digits=24, null=True)),
                ('provider_payload', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('registration', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='crypto_payments', to='events.eventregistration')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
