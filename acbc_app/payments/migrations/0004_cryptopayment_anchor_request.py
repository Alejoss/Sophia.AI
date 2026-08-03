from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0033_transcript_anchor_request'),
        ('payments', '0003_sell_knowledge_paths'),
    ]

    operations = [
        migrations.AddField(
            model_name='cryptopayment',
            name='anchor_request',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='crypto_payments',
                to='content.transcriptanchorrequest',
            ),
        ),
        migrations.RemoveConstraint(
            model_name='cryptopayment',
            name='cryptopayment_exactly_one_target',
        ),
        migrations.AddConstraint(
            model_name='cryptopayment',
            constraint=models.CheckConstraint(
                check=(
                    models.Q(
                        event_registration__isnull=False,
                        path_purchase__isnull=True,
                        anchor_request__isnull=True,
                    )
                    | models.Q(
                        event_registration__isnull=True,
                        path_purchase__isnull=False,
                        anchor_request__isnull=True,
                    )
                    | models.Q(
                        event_registration__isnull=True,
                        path_purchase__isnull=True,
                        anchor_request__isnull=False,
                    )
                ),
                name='cryptopayment_exactly_one_target',
            ),
        ),
    ]
