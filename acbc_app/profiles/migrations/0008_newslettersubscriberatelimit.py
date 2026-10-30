from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0007_help_text_updates'),
    ]

    operations = [
        migrations.CreateModel(
            name='NewsletterSubscribeRateLimit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ip_address', models.CharField(max_length=64, unique=True)),
                ('window_start', models.DateTimeField()),
                ('request_count', models.PositiveIntegerField(default=0)),
            ],
        ),
    ]
