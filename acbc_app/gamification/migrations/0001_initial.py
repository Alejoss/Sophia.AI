# Generated manually for gamification app

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Badge',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(help_text='Unique code identifier for the badge', max_length=100, unique=True)),
                ('name', models.CharField(help_text='Display name of the badge', max_length=200)),
                ('description', models.TextField(help_text='Description of what this badge represents')),
                ('icon', models.ImageField(blank=True, help_text='Icon/image for the badge', null=True, upload_to='badge_icons/')),
                ('category', models.CharField(choices=[('LEARNING', 'Learning'), ('CONTRIBUTION', 'Contribution'), ('RECOGNITION', 'Recognition'), ('FOUNDER', 'Founder')], default='LEARNING', max_length=20)),
                ('points_value', models.IntegerField(default=10, help_text='Points awarded when this badge is earned')),
                ('is_active', models.BooleanField(default=True, help_text='Whether this badge is currently active')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['category', 'points_value', 'name'],
            },
        ),
        migrations.CreateModel(
            name='UserBadge',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('earned_at', models.DateTimeField(auto_now_add=True)),
                ('points_earned', models.IntegerField(help_text='Points awarded when this badge was earned')),
                ('context_data', models.JSONField(blank=True, default=dict, help_text='Additional context data (e.g., which course was completed)')),
                ('badge', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_badges', to='gamification.badge')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_badges', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-earned_at'],
                'unique_together': {('user', 'badge')},
            },
        ),
        migrations.AddIndex(
            model_name='badge',
            index=models.Index(fields=['code'], name='gamificatio_code_idx'),
        ),
        migrations.AddIndex(
            model_name='badge',
            index=models.Index(fields=['is_active'], name='gamificatio_is_acti_idx'),
        ),
        migrations.AddIndex(
            model_name='userbadge',
            index=models.Index(fields=['user', 'badge'], name='gamificatio_user_id_idx'),
        ),
        migrations.AddIndex(
            model_name='userbadge',
            index=models.Index(fields=['earned_at'], name='gamificatio_earned__idx'),
        ),
    ]