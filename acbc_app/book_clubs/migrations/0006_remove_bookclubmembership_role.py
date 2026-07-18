from django.db import migrations


def remove_role_column_if_present(apps, schema_editor):
    """
    The role removal briefly existed under a different migration number.
    Some databases therefore already lack the column even though Django has
    not recorded this migration name. Keep the migration portable: fresh
    databases drop it, upgraded databases safely skip the database operation.
    """
    Membership = apps.get_model('book_clubs', 'BookClubMembership')
    table_name = Membership._meta.db_table

    with schema_editor.connection.cursor() as cursor:
        columns = {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(
                cursor, table_name
            )
        }

    if 'role' in columns:
        schema_editor.remove_field(Membership, Membership._meta.get_field('role'))


class Migration(migrations.Migration):

    dependencies = [
        ('book_clubs', '0005_topic_investigacion_help_text'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    remove_role_column_if_present,
                    reverse_code=migrations.RunPython.noop,
                ),
            ],
            state_operations=[
                migrations.RemoveField(
                    model_name='bookclubmembership',
                    name='role',
                ),
            ],
        ),
    ]
