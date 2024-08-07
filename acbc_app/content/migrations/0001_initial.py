# Generated by Django 5.0.6 on 2024-08-01 21:26

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Library',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(blank=True, max_length=100)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Group',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('library', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='content.library')),
            ],
        ),
        migrations.CreateModel(
            name='File',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to='files/')),
                ('title', models.CharField(max_length=255)),
                ('url', models.URLField(blank=True, null=True)),
                ('extension', models.CharField(blank=True, max_length=10)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('edition', models.CharField(blank=True, max_length=50, null=True)),
                ('year', models.IntegerField(blank=True, null=True)),
                ('author', models.CharField(blank=True, max_length=100, null=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('file_size', models.PositiveIntegerField(blank=True, null=True)),
                ('extracted_text', models.TextField(blank=True, null=True)),
                ('text_length', models.PositiveIntegerField(blank=True, null=True)),
                ('text_hash', models.CharField(blank=True, max_length=64, null=True)),
                ('ai_detection_result', models.JSONField(blank=True, null=True)),
                ('transaction_receipt', models.JSONField(blank=True, null=True)),
                ('group', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='content.group')),
                ('library', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='content.library')),
            ],
        ),
    ]
