# Generated manually - Add total_points field to Profile

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='total_points',
            field=models.IntegerField(default=0, help_text='Total gamification points earned by the user'),
        ),
    ]