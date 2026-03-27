from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('content', '0006_alter_filedetails_file'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='FileSuggestion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to='content.models.file_suggestion_upload_path')),
                ('file_size', models.PositiveBigIntegerField(blank=True, null=True)),
                ('message', models.TextField(blank=True, null=True)),
                ('rejection_reason', models.TextField(blank=True, null=True)),
                ('status', models.CharField(choices=[('PENDING', 'Pending'), ('ACCEPTED', 'Accepted'), ('REJECTED', 'Rejected')], default='PENDING', max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('content', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='file_suggestions', to='content.content')),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name='reviewed_file_suggestions', to=settings.AUTH_USER_MODEL)),
                ('suggested_by', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='file_suggestions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='filesuggestion',
            index=models.Index(fields=['content', 'status'], name='content_file_content_58ff3f_idx'),
        ),
        migrations.AddIndex(
            model_name='filesuggestion',
            index=models.Index(fields=['suggested_by', 'status'], name='content_file_suggeste_6de376_idx'),
        ),
    ]

