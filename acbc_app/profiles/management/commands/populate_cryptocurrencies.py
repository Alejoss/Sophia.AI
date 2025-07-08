from django.core.management.base import BaseCommand
from profiles.models import CryptoCurrency

class Command(BaseCommand):
    help = 'Populates the database with sample cryptocurrency data'

    def handle(self, *args, **options):
        cryptocurrencies = [
            {
                'name': 'Bitcoin',
                'code': 'BTC',
            },
            {
                'name': 'Ethereum',
                'code': 'ETH',
            },
            {
                'name': 'Cardano',
                'code': 'ADA',
            },
            {
                'name': 'Polkadot',
                'code': 'DOT',
            },
            {
                'name': 'Solana',
                'code': 'SOL',
            },
            {
                'name': 'Chainlink',
                'code': 'LINK',
            },
            {
                'name': 'Polygon',
                'code': 'MATIC',
            },
            {
                'name': 'Avalanche',
                'code': 'AVAX',
            },
            {
                'name': 'Cosmos',
                'code': 'ATOM',
            },
            {
                'name': 'Uniswap',
                'code': 'UNI',
            },
            {
                'name': 'Litecoin',
                'code': 'LTC',
            },
            {
                'name': 'Bitcoin Cash',
                'code': 'BCH',
            },
            {
                'name': 'Stellar',
                'code': 'XLM',
            },
            {
                'name': 'VeChain',
                'code': 'VET',
            },
            {
                'name': 'Filecoin',
                'code': 'FIL',
            },
        ]

        created_count = 0
        for crypto_data in cryptocurrencies:
            crypto, created = CryptoCurrency.objects.get_or_create(
                code=crypto_data['code'],
                defaults={
                    'name': crypto_data['name'],
                }
            )
            if created:
                created_count += 1
                self.stdout.write(f'Created cryptocurrency: {crypto.name} ({crypto.code})')
            else:
                self.stdout.write(f'Cryptocurrency already exists: {crypto.name} ({crypto.code})')

        self.stdout.write(
            self.style.SUCCESS(f'Successfully processed {len(cryptocurrencies)} cryptocurrencies. Created {created_count} new ones.')
        ) 