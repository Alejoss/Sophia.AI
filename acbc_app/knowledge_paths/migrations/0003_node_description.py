# Generated by Django 5.0 on 2025-02-21 22:41

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('knowledge_paths', '0002_knowledgepath_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='node',
            name='description',
            field=models.TextField(blank=True, null=True),
        ),
    ]
