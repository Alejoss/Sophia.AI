from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('content', '0036_topicchatquery_chunk_counts'),
    ]

    operations = [
        migrations.AddField(
            model_name='topic',
            name='bch_direct_enabled',
            field=models.BooleanField(
                default=False,
                help_text='Staff: offer self-custody Bitcoin Cash checkout for paid Consultas.',
            ),
        ),
        migrations.AddField(
            model_name='topic',
            name='reference_price',
            field=models.FloatField(
                blank=True,
                default=0,
                help_text='USD price for Consultas. 0 or null means consultations are free.',
                null=True,
            ),
        ),
        migrations.CreateModel(
            name='TopicPurchase',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('payment_status', models.CharField(
                    choices=[('PENDING', 'Pending'), ('PAID', 'Paid'), ('REFUNDED', 'Refunded')],
                    default='PENDING',
                    max_length=20,
                )),
                ('price_amount', models.FloatField(help_text='USD price snapshot at purchase time')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('topic', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='purchases',
                    to='content.topic',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='topic_purchases',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
                'unique_together': {('user', 'topic')},
            },
        ),
    ]
