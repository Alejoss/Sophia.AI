import events.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0005_featured_event_mobile_banner'),
    ]

    operations = [
        migrations.AlterField(
            model_name='featuredevent',
            name='desktop_image',
            field=models.ImageField(help_text='Desktop banner, 1600 px wide, any height (shown uncropped). WebP or JPEG under 200 KB. Shown under the nav on Biblioteca, Caminos, and Temas.', upload_to=events.models.upload_featured_event_banner),
        ),
        migrations.AlterField(
            model_name='featuredevent',
            name='mobile_image',
            field=models.ImageField(blank=True, help_text='Mobile banner, 1080 px wide, any height (shown uncropped). WebP or JPEG under 200 KB. Shown on screens narrower than 900 pixels.', upload_to=events.models.upload_featured_event_mobile_banner),
        ),
    ]
