from decimal import Decimal

from django.db import migrations


# 1 platform token = $0.01 USD
_UNIT_USD = Decimal('0.01')

_SEEDED = (
    ('100 tokens', 100, 1),
    ('300 tokens', 300, 2),
    ('800 tokens', 800, 3),
)


def reprice_seeded_packages(apps, schema_editor):
    TokenPackage = apps.get_model('payments', 'TokenPackage')
    for name, token_amount, sort_order in _SEEDED:
        usd_price = (Decimal(token_amount) * _UNIT_USD).quantize(Decimal('0.01'))
        updated = TokenPackage.objects.filter(name=name).update(
            token_amount=token_amount,
            usd_price=usd_price,
            sort_order=sort_order,
            is_active=True,
        )
        if not updated:
            TokenPackage.objects.create(
                name=name,
                token_amount=token_amount,
                usd_price=usd_price,
                sort_order=sort_order,
                is_active=True,
            )


def noop_reverse(apps, schema_editor):
    # Prior catalog used volume discounts; do not restore those rates.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0007_token_packages'),
    ]

    operations = [
        migrations.RunPython(reprice_seeded_packages, noop_reverse),
    ]
