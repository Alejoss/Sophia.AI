# Generated manually for file_size > 2GB support

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='filedetails',
            name='file_size',
            field=models.PositiveBigIntegerField(blank=True, null=True),
        ),
    ]
