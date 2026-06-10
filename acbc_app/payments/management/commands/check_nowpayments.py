from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.migrations.executor import MigrationExecutor
from django.db import connections

from payments.nowpayments_client import NOWPaymentsClient, NOWPaymentsError


class Command(BaseCommand):
    help = 'Verify NOWPayments configuration and API connectivity.'

    def handle(self, *args, **options):
        ok = True
        environment = getattr(settings, 'ENVIRONMENT', '')
        client = NOWPaymentsClient()
        public_url = getattr(settings, 'ACADEMIA_PUBLIC_URL', '').rstrip('/')
        ipn_url = f'{public_url}/api/payments/ipn/' if public_url else '(ACADEMIA_PUBLIC_URL not set)'

        self.stdout.write('NOWPayments health check')
        self.stdout.write('-' * 40)
        self.stdout.write(f'Environment: {environment or "(not set)"}')
        self.stdout.write(f'API URL: {client.base_url}')

        if client.configured:
            self.stdout.write(self.style.SUCCESS('API key: configured'))
        else:
            ok = False
            self.stdout.write(self.style.ERROR('API key: MISSING (NOWPAYMENTS_API_KEY)'))

        if client.ipn_secret:
            self.stdout.write(self.style.SUCCESS('IPN secret: configured'))
        elif environment == 'PRODUCTION':
            ok = False
            self.stdout.write(self.style.ERROR('IPN secret: MISSING (required in PRODUCTION)'))
        else:
            self.stdout.write(self.style.WARNING('IPN secret: not set (dev only)'))

        if public_url:
            self.stdout.write(self.style.SUCCESS(f'Public URL: {public_url}'))
        else:
            ok = False
            self.stdout.write(self.style.ERROR('Public URL: MISSING (ACADEMIA_PUBLIC_URL)'))

        self.stdout.write(f'IPN callback URL: {ipn_url}')

        executor = MigrationExecutor(connections['default'])
        plan = executor.migration_plan([('payments', None)])
        if plan:
            ok = False
            self.stdout.write(self.style.ERROR(f'Migrations: pending ({len(plan)} to apply)'))
        else:
            self.stdout.write(self.style.SUCCESS('Migrations: up to date'))

        if client.configured:
            try:
                currencies = client.get_currencies()
                count = len(currencies.get('currencies', currencies)) if isinstance(currencies, dict) else len(currencies)
                self.stdout.write(self.style.SUCCESS(f'API connectivity: OK ({count} currencies available)'))
            except NOWPaymentsError as exc:
                ok = False
                self.stdout.write(self.style.ERROR(f'API connectivity: FAILED — {exc}'))

        self.stdout.write('-' * 40)
        status_url = f'{public_url}/api/payments/status/' if public_url else '/api/payments/status/'
        self.stdout.write(f'Public status endpoint: {status_url}')

        if ok:
            self.stdout.write(self.style.SUCCESS('NOWPayments check passed.'))
        else:
            self.stdout.write(self.style.ERROR('NOWPayments check failed — fix the items above.'))
            raise SystemExit(1)
