from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('book_clubs', '0003_bookclub_telegram_group_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='bookclubmembership',
            name='additional_url',
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name='bookclubmembership',
            name='intro_description',
            field=models.TextField(
                blank=True,
                help_text='Presentación del miembro: qué hace.',
            ),
        ),
        migrations.AddField(
            model_name='bookclubmembership',
            name='intro_updated_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='bookclubmembership',
            name='social_url',
            field=models.URLField(blank=True, max_length=500),
        ),
    ]
