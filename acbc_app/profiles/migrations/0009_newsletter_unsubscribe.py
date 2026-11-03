import secrets

from django.db import migrations, models


def fill_unsubscribe_tokens(apps, schema_editor):
    NewsletterSubscription = apps.get_model('profiles', 'NewsletterSubscription')
    for subscription in NewsletterSubscription.objects.all().iterator():
        if subscription.unsubscribe_token:
            continue
        subscription.unsubscribe_token = secrets.token_urlsafe(32)
        subscription.save(update_fields=['unsubscribe_token'])


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0008_newslettersubscriberatelimit'),
    ]

    operations = [
        migrations.AddField(
            model_name='newslettersubscription',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='newslettersubscription',
            name='unsubscribed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='newslettersubscription',
            name='unsubscribe_token',
            field=models.CharField(editable=False, max_length=64, null=True, unique=True),
        ),
        migrations.RunPython(fill_unsubscribe_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='newslettersubscription',
            name='unsubscribe_token',
            field=models.CharField(editable=False, max_length=64, unique=True),
        ),
    ]
