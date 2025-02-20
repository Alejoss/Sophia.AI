# Generated by Django 5.0 on 2025-02-20 18:50

import content.models
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
            name='Content',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('media_type', models.CharField(choices=[('VIDEO', 'Video'), ('AUDIO', 'Audio'), ('TEXT', 'Text'), ('IMAGE', 'Image')], default='TEXT', max_length=5)),
                ('original_title', models.CharField(blank=True, max_length=255, null=True)),
                ('original_author', models.CharField(blank=True, max_length=255, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('uploaded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='BlockchainInteraction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('transaction_receipt', models.JSONField(blank=True, null=True)),
                ('content', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, to='content.content')),
            ],
        ),
        migrations.CreateModel(
            name='FileDetails',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to='files/')),
                ('file_size', models.PositiveIntegerField(blank=True, null=True)),
                ('extracted_text', models.TextField(blank=True, null=True)),
                ('text_length', models.PositiveIntegerField(blank=True, null=True)),
                ('text_hash', models.CharField(blank=True, max_length=64, null=True)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('content', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='file_details', to='content.content')),
            ],
        ),
        migrations.CreateModel(
            name='Library',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(blank=True, max_length=100)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Collection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('library', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='content.library')),
            ],
        ),
        migrations.CreateModel(
            name='ModerationLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('DELETE', 'Delete'), ('REPORT', 'Report')], max_length=10)),
                ('description', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('content', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='moderation_logs', to='content.content')),
                ('moderator', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='moderation_actions', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Topic',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('topic_image', models.ImageField(blank=True, max_length=255, null=True, upload_to=content.models.topic_image_path)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('creator', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
                ('moderators', models.ManyToManyField(related_name='moderated_topics', to=settings.AUTH_USER_MODEL)),
                ('related_topics', models.ManyToManyField(blank=True, related_name='related_to', to='content.topic')),
            ],
        ),
        migrations.AddField(
            model_name='content',
            name='topics',
            field=models.ManyToManyField(blank=True, related_name='contents', to='content.topic'),
        ),
        migrations.CreateModel(
            name='ContentProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(blank=True, max_length=255, null=True)),
                ('author', models.CharField(blank=True, max_length=255, null=True)),
                ('personal_note', models.TextField(blank=True, null=True)),
                ('is_visible', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('collection', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='content.collection')),
                ('content', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='profiles', to='content.content')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('content', 'user')},
            },
        ),
    ]
