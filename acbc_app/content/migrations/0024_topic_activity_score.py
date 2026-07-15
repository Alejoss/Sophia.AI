from django.db import migrations, models


def _table_columns(schema_editor, table_name):
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        description = connection.introspection.get_table_description(cursor, table_name)
    return {col.name for col in description}


def apply_activity_score_column(apps, schema_editor):
    """
    Ensure content_topic.activity_score exists with DEFAULT 0 NOT NULL.
    Idempotent for Postgres (column may already exist from a partial deploy).
    """
    table = 'content_topic'
    column = 'activity_score'
    connection = schema_editor.connection
    columns = _table_columns(schema_editor, table)

    with connection.cursor() as cursor:
        if column not in columns:
            if connection.vendor == 'postgresql':
                cursor.execute(
                    f'ALTER TABLE {table} ADD COLUMN {column} integer DEFAULT 0 NOT NULL'
                )
            else:
                # SQLite and others
                cursor.execute(
                    f'ALTER TABLE {table} ADD COLUMN {column} integer DEFAULT 0 NOT NULL'
                )
        else:
            cursor.execute(
                f'UPDATE {table} SET {column} = 0 WHERE {column} IS NULL'
            )
            if connection.vendor == 'postgresql':
                cursor.execute(
                    f'ALTER TABLE {table} ALTER COLUMN {column} SET DEFAULT 0'
                )
                cursor.execute(
                    f'ALTER TABLE {table} ALTER COLUMN {column} SET NOT NULL'
                )

        if connection.vendor == 'postgresql':
            cursor.execute(
                f'CREATE INDEX IF NOT EXISTS content_topic_activity_score_idx '
                f'ON {table} ({column})'
            )
        else:
            cursor.execute(
                f'CREATE INDEX IF NOT EXISTS content_topic_activity_score_idx '
                f'ON {table} ({column})'
            )


def noop_reverse(apps, schema_editor):
    # Keep column on reverse; state rollback is handled by SeparateDatabaseAndState.
    pass


class Migration(migrations.Migration):
    """
    Add Topic.activity_score. Production may already have the column from a partial
    deploy; apply_activity_score_column is idempotent.
    """

    dependencies = [
        ('content', '0023_topic_moderators_blank'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='topic',
                    name='activity_score',
                    field=models.IntegerField(
                        db_default=0,
                        db_index=True,
                        default=0,
                        help_text=(
                            'Cached ranking score from contents, likes, comments, '
                            'and timeline presence.'
                        ),
                    ),
                ),
            ],
            database_operations=[
                migrations.RunPython(apply_activity_score_column, noop_reverse),
            ],
        ),
    ]
