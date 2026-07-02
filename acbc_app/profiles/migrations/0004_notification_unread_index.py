from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0003_newslettersubscription'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                'CREATE INDEX IF NOT EXISTS notifications_recipient_unread_idx '
                'ON notifications_notification (recipient_id, unread);'
            ),
            reverse_sql='DROP INDEX IF EXISTS notifications_recipient_unread_idx;',
        ),
    ]
