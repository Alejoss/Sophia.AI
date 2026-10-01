from django.db import migrations

COURSE_CODE = 'real-historia-bitcoin'
NEW_TITLE = 'La Real Historia de Bitcoin y la Guerra por las Criptomonedas'
OLD_TITLE = 'La real historia de Bitcoin'


def update_course_title(apps, schema_editor):
    Course = apps.get_model('payments', 'Course')
    Course.objects.filter(code=COURSE_CODE).update(title=NEW_TITLE)


def revert_course_title(apps, schema_editor):
    Course = apps.get_model('payments', 'Course')
    Course.objects.filter(code=COURSE_CODE).update(title=OLD_TITLE)


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0016_bch_direct_course_purchase'),
    ]

    operations = [
        migrations.RunPython(update_course_title, revert_course_title),
    ]
