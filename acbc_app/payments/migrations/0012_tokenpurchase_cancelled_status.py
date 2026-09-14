from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0011_token_package_bonus_rewards'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tokenpurchase',
            name='payment_status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'),
                    ('PAID', 'Paid'),
                    ('CANCELLED', 'Cancelled'),
                    ('REFUNDED', 'Refunded'),
                ],
                db_index=True,
                default='PENDING',
                max_length=20,
            ),
        ),
    ]
