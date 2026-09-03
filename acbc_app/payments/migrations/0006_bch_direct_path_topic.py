from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0037_topic_bch_payments'),
        ('knowledge_paths', '0006_knowledgepath_bch_direct_enabled'),
        ('payments', '0005_bch_direct_payment'),
    ]

    operations = [
        migrations.AlterField(
            model_name='bchdirectpayment',
            name='anchor_request',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='bch_direct_payments',
                to='content.transcriptanchorrequest',
            ),
        ),
        migrations.AddField(
            model_name='bchdirectpayment',
            name='path_purchase',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='bch_direct_payments',
                to='knowledge_paths.knowledgepathpurchase',
            ),
        ),
        migrations.AddField(
            model_name='bchdirectpayment',
            name='topic_purchase',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='bch_direct_payments',
                to='content.topicpurchase',
            ),
        ),
        migrations.AddConstraint(
            model_name='bchdirectpayment',
            constraint=models.CheckConstraint(
                check=(
                    models.Q(
                        anchor_request__isnull=False,
                        path_purchase__isnull=True,
                        topic_purchase__isnull=True,
                    )
                    | models.Q(
                        anchor_request__isnull=True,
                        path_purchase__isnull=False,
                        topic_purchase__isnull=True,
                    )
                    | models.Q(
                        anchor_request__isnull=True,
                        path_purchase__isnull=True,
                        topic_purchase__isnull=False,
                    )
                ),
                name='bchdirectpayment_exactly_one_target',
            ),
        ),
    ]
