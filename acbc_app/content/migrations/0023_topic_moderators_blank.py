# Generated manually for optional Topic.moderators in admin/forms

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('content', '0022_topiccreationrequest'),
    ]

    operations = [
        migrations.AlterField(
            model_name='topic',
            name='moderators',
            field=models.ManyToManyField(
                blank=True,
                related_name='moderated_topics',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
