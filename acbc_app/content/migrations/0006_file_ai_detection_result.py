# Generated by Django 3.0.4 on 2024-05-14 00:25

import django.contrib.postgres.fields.jsonb
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0005_auto_20240513_1828'),
    ]

    operations = [
        migrations.AddField(
            model_name='file',
            name='ai_detection_result',
            field=django.contrib.postgres.fields.jsonb.JSONField(blank=True, null=True),
        ),
    ]
