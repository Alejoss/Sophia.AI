import events.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0004_featured_event_banner'),
    ]

    operations = [
        migrations.RenameField(
            model_name='featuredevent',
            old_name='image',
            new_name='desktop_image',
        ),
        migrations.AlterField(
            model_name='featuredevent',
            name='desktop_image',
            field=models.ImageField(help_text='Desktop banner, about 1600×280 pixels. Shown under the nav on Biblioteca, Caminos, and Temas.', upload_to=events.models.upload_featured_event_banner),
        ),
        migrations.AddField(
            model_name='featuredevent',
            name='mobile_image',
            field=models.ImageField(blank=True, help_text='Mobile banner, about 1200×500 pixels. Shown on screens narrower than 900 pixels.', upload_to=events.models.upload_featured_event_mobile_banner),
        ),
    ]
