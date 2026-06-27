from django.apps import AppConfig


class UtilsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'utils'

    def ready(self):
        from utils.db_encoding import warn_if_sql_ascii_database

        warn_if_sql_ascii_database()
