from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0042_contenttranscript_plain_format_and_docs'),
    ]

    operations = [
        migrations.AddField(
            model_name='contenttranscript',
            name='text_hash_locked',
            field=models.BooleanField(
                default=False,
                help_text=(
                    'When True, text_hash was set by an external worker (Vincent) and must '
                    'not be recomputed on save. Cleared when transcript artifacts are replaced.'
                ),
            ),
        ),
        migrations.AddField(
            model_name='contenttranscript',
            name='hash_plain_text',
            field=models.TextField(
                blank=True,
                help_text=(
                    'Exact normalized UTF-8 plain text whose SHA-256 is text_hash, when set '
                    'via external hash ingest. Preferred for public display/verification so '
                    'users can reconstruct the digest even if SQL_ASCII degraded other fields.'
                ),
            ),
        ),
    ]
