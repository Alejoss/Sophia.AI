# Generated manually - Add external_url field to Profile

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0007_suggestion'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='external_url',
            field=models.URLField(blank=True, max_length=500),
        ),
    ]
