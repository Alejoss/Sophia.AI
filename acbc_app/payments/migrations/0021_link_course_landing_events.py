from django.db import migrations

COURSE_CODE = 'real-historia-bitcoin'


def link_published_course_events(apps, schema_editor):
    """Attach a live course event to the published page that shares its title.

    Event 4 was created before an event could point at a course page, so the
    course row exists and the event does too, but nothing joins them.
    """
    Course = apps.get_model('payments', 'Course')
    Event = apps.get_model('events', 'Event')
    CourseEvent = apps.get_model('payments', 'CourseEvent')
    courses = Course.objects.filter(code=COURSE_CODE, public_landing=True)
    for course in courses:
        events = Event.objects.filter(
            title=course.title,
            event_type='LIVE_COURSE',
            deleted=False,
        )
        for event in events:
            CourseEvent.objects.get_or_create(course=course, event=event)


def unlink_published_course_events(apps, schema_editor):
    Course = apps.get_model('payments', 'Course')
    CourseEvent = apps.get_model('payments', 'CourseEvent')
    course = Course.objects.filter(code=COURSE_CODE).first()
    if course is None:
        return
    CourseEvent.objects.filter(
        course=course,
        event__title=course.title,
        event__event_type='LIVE_COURSE',
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0020_course_public_landing'),
        ('events', '0005_featured_event_mobile_banner'),
    ]

    operations = [
        migrations.RunPython(link_published_course_events, unlink_published_course_events),
    ]
