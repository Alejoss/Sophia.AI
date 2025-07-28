from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
import random
import string
from faker import Faker
from django.db import IntegrityError

from profiles.models import Profile, CryptoCurrency, AcceptedCrypto, ContactMethod

fake = Faker()

# Configuration
CONFIG = {
    'users': {
        'count': 10,
        'contact_methods_per_user': (1, 3),  # (min, max)
        'is_teacher_probability': 0.3,  # 30% chance of being a teacher
        'accepted_cryptos_per_user': (0, 2),  # (min, max)
    },
    'cryptocurrencies': {
        'create_sample_data': True,
        'sample_cryptos': [
            {'name': 'Bitcoin', 'code': 'BTC'},
            {'name': 'Ethereum', 'code': 'ETH'},
            {'name': 'Cardano', 'code': 'ADA'},
            {'name': 'Polkadot', 'code': 'DOT'},
            {'name': 'Solana', 'code': 'SOL'},
            {'name': 'Chainlink', 'code': 'LINK'},
            {'name': 'Polygon', 'code': 'MATIC'},
            {'name': 'Avalanche', 'code': 'AVAX'},
            {'name': 'Cosmos', 'code': 'ATOM'},
            {'name': 'Uniswap', 'code': 'UNI'},
        ]
    }
}

class Command(BaseCommand):
    help = 'Populates the database with users and profiles test data'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear existing data before populating')
        parser.add_argument('--skip-existing', action='store_true', dest='skip_existing', help='Skip creation of objects that already exist')
        parser.add_argument('--users', type=int, default=CONFIG['users']['count'], help='Number of users to create')

    def handle(self, *args, **options):
        if options['clear']:
            self.clear_database()
        
        self.stdout.write('Starting user and profile data population...')
        self.skip_existing = options.get('skip_existing', False)
        num_users = options.get('users', CONFIG['users']['count'])
        
        # Create cryptocurrencies if needed
        if CONFIG['cryptocurrencies']['create_sample_data']:
            self.create_cryptocurrencies()
        
        # Create users and profiles
        users = self.create_users(num_users)
        
        # Create contact methods for users
        self.create_contact_methods(users)
        
        # Create accepted cryptocurrencies for users
        self.create_accepted_cryptocurrencies(users)
        
        self.stdout.write(self.style.SUCCESS(f'Successfully populated {len(users)} users with profiles'))

    def clear_database(self):
        """Clear all user and profile related data from the database"""
        self.stdout.write('Clearing existing user and profile data...')
        
        # Delete in reverse order of dependencies
        AcceptedCrypto.objects.all().delete()
        ContactMethod.objects.all().delete()
        Profile.objects.all().delete()
        User.objects.all().delete()
        
        self.stdout.write('User and profile data cleared successfully')

    def create_cryptocurrencies(self):
        """Create sample cryptocurrencies"""
        self.stdout.write('Creating sample cryptocurrencies...')
        
        for crypto_data in CONFIG['cryptocurrencies']['sample_cryptos']:
            try:
                crypto, created = CryptoCurrency.objects.get_or_create(
                    code=crypto_data['code'],
                    defaults={
                        'name': crypto_data['name'],
                    }
                )
                if created:
                    self.stdout.write(f'Created cryptocurrency: {crypto.name} ({crypto.code})')
                else:
                    self.stdout.write(f'Cryptocurrency already exists: {crypto.name} ({crypto.code})')
            except IntegrityError:
                self.stdout.write(self.style.WARNING(f'Failed to create cryptocurrency: {crypto_data["name"]}'))
                continue

    def create_users(self, num_users):
        """Create users with profiles"""
        users = []
        for i in range(num_users):
            try:
                username = fake.user_name()
                email = fake.email()
                password = ''.join(random.choices(string.ascii_letters + string.digits, k=12))
                
                # Check if user already exists
                if self.skip_existing and User.objects.filter(username=username).exists():
                    self.stdout.write(f'Skipping existing user: {username}')
                    continue
                
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=fake.first_name(),
                    last_name=fake.last_name()
                )
                
                # Create profile
                profile = Profile.objects.create(
                    user=user,
                    interests=fake.text(max_nb_chars=250),
                    profile_description=fake.text(max_nb_chars=500),
                    timezone=fake.timezone(),
                    is_teacher=random.random() < CONFIG['users']['is_teacher_probability']
                )
                
                users.append(user)
                self.stdout.write(f'Created user: {username} (Teacher: {profile.is_teacher})')
            except IntegrityError:
                self.stdout.write(self.style.WARNING(f'Failed to create user: {username} (already exists)'))
                continue
        
        return users

    def create_contact_methods(self, users):
        """Create contact methods for users"""
        self.stdout.write('Creating contact methods for users...')
        
        contact_types = [
            {'name': 'LinkedIn', 'description': 'Professional networking'},
            {'name': 'Twitter', 'description': 'Social media'},
            {'name': 'GitHub', 'description': 'Code repository'},
            {'name': 'Website', 'description': 'Personal website'},
            {'name': 'Email', 'description': 'Direct contact'},
            {'name': 'Telegram', 'description': 'Messaging platform'},
        ]
        
        for user in users:
            num_contact_methods = random.randint(*CONFIG['users']['contact_methods_per_user'])
            selected_types = random.sample(contact_types, min(num_contact_methods, len(contact_types)))
            
            for contact_type in selected_types:
                try:
                    # Check if contact method already exists
                    if self.skip_existing and ContactMethod.objects.filter(user=user, name=contact_type['name']).exists():
                        continue
                    
                    ContactMethod.objects.create(
                        user=user,
                        name=contact_type['name'],
                        description=contact_type['description'],
                        url_link=fake.url() if random.choice([True, False]) else ''
                    )
                except IntegrityError:
                    self.stdout.write(self.style.WARNING(f'Failed to create contact method for user: {user.username}'))
                    continue

    def create_accepted_cryptocurrencies(self, users):
        """Create accepted cryptocurrencies for users"""
        self.stdout.write('Creating accepted cryptocurrencies for users...')
        
        cryptocurrencies = list(CryptoCurrency.objects.all())
        if not cryptocurrencies:
            self.stdout.write(self.style.WARNING('No cryptocurrencies available to assign to users'))
            return
        
        for user in users:
            num_cryptos = random.randint(*CONFIG['users']['accepted_cryptos_per_user'])
            if num_cryptos > 0:
                selected_cryptos = random.sample(cryptocurrencies, min(num_cryptos, len(cryptocurrencies)))
                
                for crypto in selected_cryptos:
                    try:
                        # Check if accepted crypto already exists
                        if self.skip_existing and AcceptedCrypto.objects.filter(user=user, crypto=crypto).exists():
                            continue
                        
                        AcceptedCrypto.objects.create(
                            user=user,
                            crypto=crypto,
                            address=fake.sha256()[:42]  # Simulate crypto address
                        )
                    except IntegrityError:
                        self.stdout.write(self.style.WARNING(f'Failed to create accepted crypto for user: {user.username}'))
                        continue 