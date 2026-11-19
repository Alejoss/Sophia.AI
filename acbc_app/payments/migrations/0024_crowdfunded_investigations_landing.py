from django.db import migrations

CODE = 'crowdfunded-investigations'


def add_funding_destination(apps, schema_editor):
    Course = apps.get_model('payments', 'Course')
    Course.objects.get_or_create(
        code=CODE,
        defaults={
            'title': 'Crowdfunded investigations',
            'price_usd': 0,
            'sales_enabled': False,
            'public_landing': True,
        },
    )


def remove_funding_destination(apps, schema_editor):
    Course = apps.get_model('payments', 'Course')
    Course.objects.filter(code=CODE, price_usd=0, sales_enabled=False).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0023_course_purchase_guest_checkout'),
    ]

    operations = [
        migrations.RunPython(add_funding_destination, remove_funding_destination),
    ]
