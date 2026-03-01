#!/usr/bin/env python
"""
Test runner for events functionality tests.
Run this script to execute all events-related tests using Django's test runner.
"""

import os
import sys
import django

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Use SQLite for tests when PostgreSQL is not available (run before Django setup)
os.environ.setdefault("USE_SQLITE_FOR_TESTS", "1")

# Set up Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "academia_blockchain.settings")
django.setup()

from django.conf import settings
from django.test.utils import get_runner

def run_events_tests():
    """Run all events-related tests."""
    TestRunner = get_runner(settings)
    test_runner = TestRunner()
    
    # Define test patterns for events functionality
    test_patterns = [
        'tests.test_events_models',
        'tests.test_events_serializers', 
        'tests.test_events_views',
        'tests.test_events_integration',
    ]
    
    failures = test_runner.run_tests(test_patterns)
    return failures

if __name__ == '__main__':
    failures = run_events_tests()
    
    if failures:
        sys.exit(1)
    else:
        sys.exit(0) 