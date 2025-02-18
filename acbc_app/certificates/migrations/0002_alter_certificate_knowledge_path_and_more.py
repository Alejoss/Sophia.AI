# Generated by Django 5.0 on 2025-02-18 16:06

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('certificates', '0001_initial'),
        ('knowledge_paths', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='certificate',
            name='knowledge_path',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='knowledge_paths.knowledgepath'),
        ),
        migrations.AlterField(
            model_name='certificaterequest',
            name='knowledge_path',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='knowledge_paths.knowledgepath'),
        ),
    ]
