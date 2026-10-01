import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0015_coursepurchase_receipt_email'),
    ]

    operations = [
        migrations.AddField(
            model_name='bchdirectpayment',
            name='course_purchase',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='bch_direct_payments',
                to='payments.coursepurchase',
            ),
        ),
        migrations.RemoveConstraint(
            model_name='bchdirectpayment',
            name='bchdirectpayment_exactly_one_target',
        ),
        migrations.AddConstraint(
            model_name='bchdirectpayment',
            constraint=models.CheckConstraint(
                check=(
                    models.Q(
                        anchor_request__isnull=False,
                        path_purchase__isnull=True,
                        topic_purchase__isnull=True,
                        token_purchase__isnull=True,
                        course_purchase__isnull=True,
                    )
                    | models.Q(
                        anchor_request__isnull=True,
                        path_purchase__isnull=False,
                        topic_purchase__isnull=True,
                        token_purchase__isnull=True,
                        course_purchase__isnull=True,
                    )
                    | models.Q(
                        anchor_request__isnull=True,
                        path_purchase__isnull=True,
                        topic_purchase__isnull=False,
                        token_purchase__isnull=True,
                        course_purchase__isnull=True,
                    )
                    | models.Q(
                        anchor_request__isnull=True,
                        path_purchase__isnull=True,
                        topic_purchase__isnull=True,
                        token_purchase__isnull=False,
                        course_purchase__isnull=True,
                    )
                    | models.Q(
                        anchor_request__isnull=True,
                        path_purchase__isnull=True,
                        topic_purchase__isnull=True,
                        token_purchase__isnull=True,
                        course_purchase__isnull=False,
                    )
                ),
                name='bchdirectpayment_exactly_one_target',
            ),
        ),
    ]
