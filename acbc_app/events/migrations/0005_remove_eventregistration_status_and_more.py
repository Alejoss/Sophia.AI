# Generated by Django 5.0 on 2025-07-03 00:01

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0004_eventregistration'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='eventregistration',
            name='status',
        ),
        migrations.AddField(
            model_name='eventregistration',
            name='registration_status',
            field=models.CharField(choices=[('REGISTERED', 'Registered'), ('CANCELLED', 'Cancelled')], default='REGISTERED', max_length=20),
        ),
    ]
