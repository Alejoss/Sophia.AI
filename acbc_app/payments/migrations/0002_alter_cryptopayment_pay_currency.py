from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='cryptopayment',
            name='pay_currency',
            field=models.CharField(blank=True, default='', max_length=16),
        ),
    ]
