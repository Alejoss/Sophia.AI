from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('book_clubs', '0001_initial'),
        ('knowledge_paths', '0003_knowledgepath_image_preview'),
    ]

    operations = [
        migrations.AlterField(
            model_name='bookclub',
            name='slug',
            field=models.SlugField(blank=True, max_length=220, unique=True),
        ),
        migrations.AlterField(
            model_name='bookclub',
            name='knowledge_path',
            field=models.ForeignKey(
                blank=True,
                help_text='Optional. If omitted on create, an empty path is created for missions.',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='book_clubs',
                to='knowledge_paths.knowledgepath',
            ),
        ),
    ]
