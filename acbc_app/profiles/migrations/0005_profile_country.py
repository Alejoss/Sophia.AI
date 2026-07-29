from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0004_notification_unread_index'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='country',
            field=models.CharField(
                blank=True,
                help_text='País del usuario (presentación / perfil público).',
                max_length=100,
            ),
        ),
    ]
