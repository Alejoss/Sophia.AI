import django.db.models.deletion
from django.db import migrations, models


def _bch_check():
    Q = models.Q
    return (
        Q(
            anchor_request__isnull=False,
            path_purchase__isnull=True,
            topic_purchase__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
            event_registration__isnull=True,
        )
        | Q(
            anchor_request__isnull=True,
            path_purchase__isnull=False,
            topic_purchase__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
            event_registration__isnull=True,
        )
        | Q(
            anchor_request__isnull=True,
            path_purchase__isnull=True,
            topic_purchase__isnull=False,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
            event_registration__isnull=True,
        )
        | Q(
            anchor_request__isnull=True,
            path_purchase__isnull=True,
            topic_purchase__isnull=True,
            token_purchase__isnull=False,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
            event_registration__isnull=True,
        )
        | Q(
            anchor_request__isnull=True,
            path_purchase__isnull=True,
            topic_purchase__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=False,
            transcript_generation__isnull=True,
            event_registration__isnull=True,
        )
        | Q(
            anchor_request__isnull=True,
            path_purchase__isnull=True,
            topic_purchase__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=False,
            event_registration__isnull=True,
        )
        | Q(
            anchor_request__isnull=True,
            path_purchase__isnull=True,
            topic_purchase__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
            event_registration__isnull=False,
        )
    )


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0006_featured_event_banner_size_help'),
        ('payments', '0021_link_course_landing_events'),
    ]

    operations = [
        migrations.AddField(
            model_name='bchdirectpayment',
            name='event_registration',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='bch_direct_payments',
                to='events.eventregistration',
            ),
        ),
        migrations.RemoveConstraint(
            model_name='bchdirectpayment',
            name='bchdirectpayment_exactly_one_target',
        ),
        migrations.AddConstraint(
            model_name='bchdirectpayment',
            constraint=models.CheckConstraint(
                check=_bch_check(),
                name='bchdirectpayment_exactly_one_target',
            ),
        ),
    ]
