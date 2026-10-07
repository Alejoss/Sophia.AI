from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('certificates', '0004_certificate_completion_reward'),
    ]

    operations = [
        migrations.AddField(
            model_name='certificate',
            name='reward_image',
            field=models.FileField(blank=True, help_text='Backup of the completion-reward image. The metadata image URI is reward_image_uri when set.', null=True, upload_to='nft_rewards/'),
        ),
        migrations.AddField(
            model_name='certificate',
            name='reward_image_uri',
            field=models.TextField(blank=True, default='', help_text='Permanent image URI, usually ipfs://. Preferred over the uploaded file in token metadata.'),
        ),
    ]
