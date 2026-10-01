from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0014_course_path_and_events'),
    ]

    operations = [
        migrations.AddField(
            model_name='coursepurchase',
            name='receipt_email',
            field=models.EmailField(
                blank=True,
                default='',
                help_text='Email confirmed at checkout for receipt and course access notices.',
                max_length=254,
            ),
        ),
    ]
