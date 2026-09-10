from decimal import Decimal

from django.db import migrations, models


_UNIT_USD = Decimal('0.01')

# Paid face value + optional bonus reward. usd_price = token_amount × $0.01.
_CATALOG = (
    {
        'name': '300 tokens',
        'token_amount': 300,
        'bonus_tokens': 0,
        'sort_order': 1,
    },
    {
        'name': '800 tokens + 50 bonus',
        'token_amount': 800,
        'bonus_tokens': 50,
        'sort_order': 2,
    },
    {
        'name': '1200 tokens + 200 bonus',
        'token_amount': 1200,
        'bonus_tokens': 200,
        'sort_order': 3,
    },
)

_LEGACY_NAMES = (
    '100 tokens',
    '300 tokens',
    '800 tokens',
    '800 tokens + 50 bonus',
    '1200 tokens + 200 bonus',
)


def seed_reward_packages(apps, schema_editor):
    TokenPackage = apps.get_model('payments', 'TokenPackage')
    TokenPackage.objects.filter(name__in=_LEGACY_NAMES).update(is_active=False)

    for row in _CATALOG:
        usd_price = (Decimal(row['token_amount']) * _UNIT_USD).quantize(Decimal('0.01'))
        existing = TokenPackage.objects.filter(name=row['name']).first()
        fields = {
            'token_amount': row['token_amount'],
            'bonus_tokens': row['bonus_tokens'],
            'usd_price': usd_price,
            'sort_order': row['sort_order'],
            'is_active': True,
        }
        if existing:
            for key, value in fields.items():
                setattr(existing, key, value)
            existing.save()
        else:
            TokenPackage.objects.create(name=row['name'], **fields)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0008_platform_token_unit_price'),
    ]

    operations = [
        migrations.AddField(
            model_name='tokenpackage',
            name='bonus_tokens',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Extra tokens credited on purchase (reward). Not charged.',
            ),
        ),
        migrations.AddField(
            model_name='tokenpurchase',
            name='bonus_tokens',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Bonus tokens snapshot credited with the purchase.',
            ),
        ),
        migrations.AlterField(
            model_name='tokenpackage',
            name='token_amount',
            field=models.PositiveIntegerField(help_text='Paid tokens (face value).'),
        ),
        migrations.AlterField(
            model_name='tokenpurchase',
            name='token_amount',
            field=models.PositiveIntegerField(help_text='Paid tokens snapshot.'),
        ),
        migrations.RunPython(seed_reward_packages, noop_reverse),
    ]
