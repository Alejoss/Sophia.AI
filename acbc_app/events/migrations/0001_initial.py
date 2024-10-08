# Generated by Django 5.0 on 2024-10-08 17:44

import django.db.models.deletion
import events.models
import taggit.managers
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('taggit', '0003_taggeditem_add_unique_index'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ConnectionPlatform',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(choices=[('twitch', 'Twitch'), ('youtube', 'YouTube'), ('facebook', 'Facebook Gaming'), ('mixer', 'Mixer')], max_length=50, unique=True)),
            ],
            options={
                'verbose_name': 'Streaming Platform',
                'verbose_name_plural': 'Streaming Platforms',
            },
        ),
        migrations.CreateModel(
            name='Event',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(blank=True, choices=[('LIVE_COURSE', 'Live_Course'), ('EVENT', 'Event'), ('EXAM', 'Exam'), ('PRE_RECORDED', 'Pre_Recorded')], max_length=50)),
                ('is_recurrent', models.BooleanField(default=False, null=True)),
                ('image', models.ImageField(blank=True, null=True, upload_to=events.models.upload_event_picture)),
                ('title', models.CharField(blank=True, max_length=150)),
                ('description', models.CharField(blank=True, max_length=10000)),
                ('other_platform', models.CharField(blank=True, max_length=150)),
                ('reference_price', models.FloatField(blank=True, default=0, null=True)),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('date_start', models.DateTimeField(blank=True, null=True)),
                ('date_end', models.DateTimeField(blank=True, null=True)),
                ('date_recorded', models.DateTimeField(blank=True, null=True)),
                ('schedule_description', models.CharField(blank=True, max_length=1000)),
                ('deleted', models.BooleanField(blank=True, default=False)),
                ('owner', models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
                ('platform', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='events.connectionplatform')),
                ('tags', taggit.managers.TaggableManager(blank=True, help_text='A comma-separated list of tags.', through='taggit.TaggedItem', to='taggit.Tag', verbose_name='Tags')),
            ],
        ),
    ]
