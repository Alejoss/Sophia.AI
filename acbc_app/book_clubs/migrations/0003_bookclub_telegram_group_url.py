from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('book_clubs', '0002_bookclub_optional_path_and_slug'),
    ]

    operations = [
        migrations.AddField(
            model_name='bookclub',
            name='telegram_group_url',
            field=models.URLField(
                blank=True,
                help_text='Link al grupo de Telegram del ciclo (t.me/...).',
                max_length=500,
            ),
        ),
    ]
