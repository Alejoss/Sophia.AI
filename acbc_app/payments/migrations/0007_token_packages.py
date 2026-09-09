from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def seed_token_packages(apps, schema_editor):
    TokenPackage = apps.get_model('payments', 'TokenPackage')
    packages = [
        {
            'name': '100 tokens',
            'token_amount': 100,
            'usd_price': Decimal('5.00'),
            'sort_order': 1,
        },
        {
            'name': '300 tokens',
            'token_amount': 300,
            'usd_price': Decimal('12.00'),
            'sort_order': 2,
        },
        {
            'name': '800 tokens',
            'token_amount': 800,
            'usd_price': Decimal('25.00'),
            'sort_order': 3,
        },
    ]
    for package in packages:
        TokenPackage.objects.get_or_create(
            name=package['name'],
            defaults={
                **package,
                'is_active': True,
            },
        )


def unseed_token_packages(apps, schema_editor):
    TokenPackage = apps.get_model('payments', 'TokenPackage')
    TokenPackage.objects.filter(
        name__in=['100 tokens', '300 tokens', '800 tokens'],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('payments', '0006_bch_direct_path_topic'),
    ]

    operations = [
        migrations.CreateModel(
            name='TokenPackage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=80)),
                ('token_amount', models.PositiveIntegerField()),
                ('usd_price', models.DecimalField(decimal_places=2, max_digits=12)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['sort_order', 'token_amount', 'id'],
            },
        ),
        migrations.CreateModel(
            name='TokenPurchase',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('package_name', models.CharField(blank=True, default='', max_length=80)),
                ('token_amount', models.PositiveIntegerField()),
                ('usd_price', models.DecimalField(decimal_places=2, max_digits=12)),
                ('payment_status', models.CharField(
                    choices=[('PENDING', 'Pending'), ('PAID', 'Paid'), ('REFUNDED', 'Refunded')],
                    db_index=True,
                    default='PENDING',
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('package', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='purchases',
                    to='payments.tokenpackage',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='token_purchases',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='TokenLedgerEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('delta', models.IntegerField(help_text='Signed token amount. Credits are positive.')),
                ('reason', models.CharField(
                    choices=[
                        ('purchase', 'Purchase'),
                        ('adjustment', 'Adjustment'),
                        ('spend', 'Spend'),
                    ],
                    db_index=True,
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('token_purchase', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='ledger_entries',
                    to='payments.tokenpurchase',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='token_ledger_entries',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='tokenledgerentry',
            constraint=models.UniqueConstraint(
                condition=models.Q(('reason', 'purchase'), ('token_purchase__isnull', False)),
                fields=('token_purchase',),
                name='unique_token_purchase_ledger_credit',
            ),
        ),
        migrations.AddField(
            model_name='cryptopayment',
            name='token_purchase',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='crypto_payments',
                to='payments.tokenpurchase',
            ),
        ),
        migrations.AddField(
            model_name='bchdirectpayment',
            name='token_purchase',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='bch_direct_payments',
                to='payments.tokenpurchase',
            ),
        ),
        migrations.RemoveConstraint(
            model_name='cryptopayment',
            name='cryptopayment_exactly_one_target',
        ),
        migrations.AddConstraint(
            model_name='cryptopayment',
            constraint=models.CheckConstraint(
                check=(
                    models.Q(
                        event_registration__isnull=False,
                        path_purchase__isnull=True,
                        anchor_request__isnull=True,
                        token_purchase__isnull=True,
                    )
                    | models.Q(
                        event_registration__isnull=True,
                        path_purchase__isnull=False,
                        anchor_request__isnull=True,
                        token_purchase__isnull=True,
                    )
                    | models.Q(
                        event_registration__isnull=True,
                        path_purchase__isnull=True,
                        anchor_request__isnull=False,
                        token_purchase__isnull=True,
                    )
                    | models.Q(
                        event_registration__isnull=True,
                        path_purchase__isnull=True,
                        anchor_request__isnull=True,
                        token_purchase__isnull=False,
                    )
                ),
                name='cryptopayment_exactly_one_target',
            ),
        ),
        migrations.RemoveConstraint(
            model_name='bchdirectpayment',
            name='bchdirectpayment_exactly_one_target',
        ),
        migrations.AddConstraint(
            model_name='bchdirectpayment',
            constraint=models.CheckConstraint(
                check=(
                    models.Q(
                        anchor_request__isnull=False,
                        path_purchase__isnull=True,
                        topic_purchase__isnull=True,
                        token_purchase__isnull=True,
                    )
                    | models.Q(
                        anchor_request__isnull=True,
                        path_purchase__isnull=False,
                        topic_purchase__isnull=True,
                        token_purchase__isnull=True,
                    )
                    | models.Q(
                        anchor_request__isnull=True,
                        path_purchase__isnull=True,
                        topic_purchase__isnull=False,
                        token_purchase__isnull=True,
                    )
                    | models.Q(
                        anchor_request__isnull=True,
                        path_purchase__isnull=True,
                        topic_purchase__isnull=True,
                        token_purchase__isnull=False,
                    )
                ),
                name='bchdirectpayment_exactly_one_target',
            ),
        ),
        migrations.RunPython(seed_token_packages, unseed_token_packages),
    ]
