#!/usr/bin/env python3
"""
Database connection debugging script
Run this inside the backend container to debug database connection issues
"""

import os
import psycopg2
from psycopg2 import OperationalError

def print_environment_variables():
    """Print all relevant environment variables"""
    print("=== Environment Variables ===")
    relevant_vars = [
        'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT',
        'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD'
    ]
    
    for var in relevant_vars:
        value = os.environ.get(var, 'NOT SET')
        print(f"{var}: {value}")
    
    print("\n=== All Environment Variables ===")
    for key, value in os.environ.items():
        if 'DB' in key or 'POSTGRES' in key:
            print(f"{key}: {value}")

def test_database_connection():
    """Test database connection with different configurations"""
    print("\n=== Testing Database Connection ===")
    
    # Try different connection configurations
    configs = [
        {
            'name': 'Using DB_* variables',
            'host': os.environ.get('DB_HOST', 'postgres'),
            'port': os.environ.get('DB_PORT', '5432'),
            'database': os.environ.get('DB_NAME', 'acbc_db'),
            'user': os.environ.get('DB_USER', 'postgres'),
            'password': os.environ.get('DB_PASSWORD', 'postgres')
        },
        {
            'name': 'Using POSTGRES_* variables',
            'host': 'postgres',
            'port': '5432',
            'database': os.environ.get('POSTGRES_DB', 'acbc_db'),
            'user': os.environ.get('POSTGRES_USER', 'postgres'),
            'password': os.environ.get('POSTGRES_PASSWORD', 'postgres')
        },
        {
            'name': 'Direct connection to postgres',
            'host': 'postgres',
            'port': '5432',
            'database': 'postgres',
            'user': 'postgres',
            'password': 'postgres'
        }
    ]
    
    for config in configs:
        print(f"\n--- Testing: {config['name']} ---")
        print(f"Host: {config['host']}")
        print(f"Port: {config['port']}")
        print(f"Database: {config['database']}")
        print(f"User: {config['user']}")
        print(f"Password: {'*' * len(config['password']) if config['password'] else 'None'}")
        
        try:
            conn = psycopg2.connect(
                host=config['host'],
                port=config['port'],
                database=config['database'],
                user=config['user'],
                password=config['password']
            )
            print("✅ Connection successful!")
            
            # Test a simple query
            cursor = conn.cursor()
            cursor.execute("SELECT version();")
            version = cursor.fetchone()
            print(f"PostgreSQL version: {version[0]}")
            
            cursor.close()
            conn.close()
            return True
            
        except OperationalError as e:
            print(f"❌ Connection failed: {e}")
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
    
    return False

def test_network_connectivity():
    """Test network connectivity to postgres"""
    print("\n=== Testing Network Connectivity ===")
    
    import socket
    
    try:
        # Test if we can resolve the hostname
        ip = socket.gethostbyname('postgres')
        print(f"✅ Hostname 'postgres' resolves to: {ip}")
        
        # Test if we can connect to the port
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex(('postgres', 5432))
        sock.close()
        
        if result == 0:
            print("✅ Port 5432 is reachable")
        else:
            print(f"❌ Port 5432 is not reachable (error code: {result})")
            
    except socket.gaierror as e:
        print(f"❌ Cannot resolve hostname 'postgres': {e}")
    except Exception as e:
        print(f"❌ Network test failed: {e}")

if __name__ == "__main__":
    print("Database Connection Debug Script")
    print("=" * 40)
    
    print_environment_variables()
    test_network_connectivity()
    success = test_database_connection()
    
    if success:
        print("\n🎉 Database connection is working!")
    else:
        print("\n💥 All database connection attempts failed!")
        print("\nTroubleshooting tips:")
        print("1. Make sure PostgreSQL container is running: docker-compose ps")
        print("2. Check PostgreSQL logs: docker-compose logs postgres")
        print("3. Verify environment variables in docker-compose.yml")
        print("4. Try restarting containers: docker-compose down && docker-compose up --build")
