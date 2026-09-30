from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
from django.db.models import Q


def seed_real_historia_bitcoin(apps, schema_editor):
    Course = apps.get_model('payments', 'Course')
    Course.objects.get_or_create(
        code='real-historia-bitcoin',
        defaults={
            'title': 'La real historia de Bitcoin',
            'price_usd': 35,
            'sales_enabled': True,
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('payments', '0012_tokenpurchase_cancelled_status'),
    ]

    operations = [
        migrations.CreateModel(
            name='Course',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.SlugField(max_length=64, unique=True)),
                ('title', models.CharField(max_length=200)),
                ('price_usd', models.FloatField(default=0, help_text='Precio en USD. 0 significa que el curso no está a la venta.')),
                ('sales_enabled', models.BooleanField(default=True, help_text='Permite cobrar este curso cuando tiene precio.')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['title'],
            },
        ),
        migrations.RunPython(seed_real_historia_bitcoin, migrations.RunPython.noop),
        migrations.CreateModel(
            name='CoursePurchase',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('price_amount', models.FloatField(help_text='USD price copied from the course when checkout opened.')),
                ('payment_status', models.CharField(
                    choices=[('PENDING', 'Pending'), ('PAID', 'Paid'), ('REFUNDED', 'Refunded')],
                    default='PENDING',
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('course', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='purchases',
                    to='payments.course',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='course_purchases',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='coursepurchase',
            constraint=models.UniqueConstraint(
                fields=('user', 'course'),
                name='course_purchase_one_per_user',
            ),
        ),
        migrations.AddField(
            model_name='cryptopayment',
            name='course_purchase',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='crypto_payments',
                to='payments.coursepurchase',
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
                    Q(
                        event_registration__isnull=False,
                        path_purchase__isnull=True,
                        anchor_request__isnull=True,
                        token_purchase__isnull=True,
                        course_purchase__isnull=True,
                    )
                    | Q(
                        event_registration__isnull=True,
                        path_purchase__isnull=False,
                        anchor_request__isnull=True,
                        token_purchase__isnull=True,
                        course_purchase__isnull=True,
                    )
                    | Q(
                        event_registration__isnull=True,
                        path_purchase__isnull=True,
                        anchor_request__isnull=False,
                        token_purchase__isnull=True,
                        course_purchase__isnull=True,
                    )
                    | Q(
                        event_registration__isnull=True,
                        path_purchase__isnull=True,
                        anchor_request__isnull=True,
                        token_purchase__isnull=False,
                        course_purchase__isnull=True,
                    )
                    | Q(
                        event_registration__isnull=True,
                        path_purchase__isnull=True,
                        anchor_request__isnull=True,
                        token_purchase__isnull=True,
                        course_purchase__isnull=False,
                    )
                ),
                name='cryptopayment_exactly_one_target',
            ),
        ),
    ]
