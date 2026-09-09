from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0005_profile_country'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='token_balance',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Cached platform token balance. Mutate only via credit_platform_tokens.',
            ),
        ),
    ]
