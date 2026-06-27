#!/usr/bin/env python
from django.core.management.base import BaseCommand

from utils.db_encoding import get_postgres_encodings, is_sql_ascii_database


class Command(BaseCommand):
    help = 'Report PostgreSQL server/client encoding for Unicode readiness.'

    def handle(self, *args, **options):
        encodings = get_postgres_encodings()
        if encodings is None:
            self.stdout.write(self.style.WARNING('Not using PostgreSQL (e.g. SQLite in tests).'))
            return

        server = encodings['server']
        client = encodings['client']
        self.stdout.write(f'Server encoding: {server}')
        self.stdout.write(f'Client encoding: {client}')

        if is_sql_ascii_database():
            self.stdout.write(
                self.style.ERROR(
                    'SQL_ASCII detected — Unicode input will fail. '
                    'Run ./scripts/migrate-db-to-utf8.sh on the production host.'
                )
            )
            raise SystemExit(1)

        if server == 'UTF8':
            self.stdout.write(self.style.SUCCESS('Database is UTF8-ready for international text.'))
        else:
            self.stdout.write(self.style.WARNING(f'Unexpected server encoding: {server}'))
