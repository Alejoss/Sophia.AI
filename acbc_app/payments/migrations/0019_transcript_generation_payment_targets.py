import django.db.models.deletion
from django.db import migrations, models


def _crypto_check():
    Q = models.Q
    return (
        Q(
            event_registration__isnull=False,
            path_purchase__isnull=True,
            anchor_request__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
        )
        | Q(
            event_registration__isnull=True,
            path_purchase__isnull=False,
            anchor_request__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
        )
        | Q(
            event_registration__isnull=True,
            path_purchase__isnull=True,
            anchor_request__isnull=False,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
        )
        | Q(
            event_registration__isnull=True,
            path_purchase__isnull=True,
            anchor_request__isnull=True,
            token_purchase__isnull=False,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
        )
        | Q(
            event_registration__isnull=True,
            path_purchase__isnull=True,
            anchor_request__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=False,
            transcript_generation__isnull=True,
        )
        | Q(
            event_registration__isnull=True,
            path_purchase__isnull=True,
            anchor_request__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=False,
        )
    )


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
        )
        | Q(
            anchor_request__isnull=True,
            path_purchase__isnull=False,
            topic_purchase__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
        )
        | Q(
            anchor_request__isnull=True,
            path_purchase__isnull=True,
            topic_purchase__isnull=False,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
        )
        | Q(
            anchor_request__isnull=True,
            path_purchase__isnull=True,
            topic_purchase__isnull=True,
            token_purchase__isnull=False,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
        )
        | Q(
            anchor_request__isnull=True,
            path_purchase__isnull=True,
            topic_purchase__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=False,
            transcript_generation__isnull=True,
        )
        | Q(
            anchor_request__isnull=True,
            path_purchase__isnull=True,
            topic_purchase__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=False,
        )
    )


def _payphone_check():
    Q = models.Q
    return (
        Q(
            event_registration__isnull=False,
            path_purchase__isnull=True,
            topic_purchase__isnull=True,
            anchor_request__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
        )
        | Q(
            event_registration__isnull=True,
            path_purchase__isnull=False,
            topic_purchase__isnull=True,
            anchor_request__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
        )
        | Q(
            event_registration__isnull=True,
            path_purchase__isnull=True,
            topic_purchase__isnull=False,
            anchor_request__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
        )
        | Q(
            event_registration__isnull=True,
            path_purchase__isnull=True,
            topic_purchase__isnull=True,
            anchor_request__isnull=False,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
        )
        | Q(
            event_registration__isnull=True,
            path_purchase__isnull=True,
            topic_purchase__isnull=True,
            anchor_request__isnull=True,
            token_purchase__isnull=False,
            course_purchase__isnull=True,
            transcript_generation__isnull=True,
        )
        | Q(
            event_registration__isnull=True,
            path_purchase__isnull=True,
            topic_purchase__isnull=True,
            anchor_request__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=False,
            transcript_generation__isnull=True,
        )
        | Q(
            event_registration__isnull=True,
            path_purchase__isnull=True,
            topic_purchase__isnull=True,
            anchor_request__isnull=True,
            token_purchase__isnull=True,
            course_purchase__isnull=True,
            transcript_generation__isnull=False,
        )
    )


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0045_transcript_generation_request'),
        ('payments', '0018_payphone_payment'),
    ]

    operations = [
        migrations.AddField(
            model_name='cryptopayment',
            name='transcript_generation',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='crypto_payments',
                to='content.transcriptgenerationrequest',
            ),
        ),
        migrations.AddField(
            model_name='bchdirectpayment',
            name='transcript_generation',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='bch_direct_payments',
                to='content.transcriptgenerationrequest',
            ),
        ),
        migrations.AddField(
            model_name='payphonepayment',
            name='transcript_generation',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='payphone_payments',
                to='content.transcriptgenerationrequest',
            ),
        ),
        migrations.AddField(
            model_name='tokenledgerentry',
            name='transcript_generation',
            field=models.ForeignKey(
                blank=True,
                help_text='Set when reason=spend for a paid transcript generation request.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='token_ledger_entries',
                to='content.transcriptgenerationrequest',
            ),
        ),
        migrations.RemoveConstraint(
            model_name='cryptopayment',
            name='cryptopayment_exactly_one_target',
        ),
        migrations.AddConstraint(
            model_name='cryptopayment',
            constraint=models.CheckConstraint(
                check=_crypto_check(),
                name='cryptopayment_exactly_one_target',
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
        migrations.RemoveConstraint(
            model_name='payphonepayment',
            name='payphonepayment_exactly_one_target',
        ),
        migrations.AddConstraint(
            model_name='payphonepayment',
            constraint=models.CheckConstraint(
                check=_payphone_check(),
                name='payphonepayment_exactly_one_target',
            ),
        ),
        migrations.AddConstraint(
            model_name='tokenledgerentry',
            constraint=models.UniqueConstraint(
                condition=models.Q(reason='spend') & models.Q(transcript_generation__isnull=False),
                fields=('transcript_generation',),
                name='unique_token_transcript_generation_spend',
            ),
        ),
    ]
