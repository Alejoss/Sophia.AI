from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0026_collection_description'),
    ]

    operations = [
        migrations.AddField(
            model_name='contentprofile',
            name='is_featured',
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text='When true, eligible to appear in the Search page featured books section.',
            ),
        ),
        migrations.AddField(
            model_name='contentprofile',
            name='featured_order',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Lower values appear first among featured books.',
            ),
        ),
    ]
