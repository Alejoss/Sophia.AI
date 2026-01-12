# Generated manually - Add featured_badge field to Profile

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0002_profile_total_points'),
        ('profiles', '0005_alter_cryptocurrency_thumbnail'),
        ('gamification', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='featured_badge',
            field=models.ForeignKey(
                blank=True,
                help_text='Badge destacado que se muestra junto al nombre de usuario',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='featured_profiles',
                to='gamification.userbadge'
            ),
        ),
    ]