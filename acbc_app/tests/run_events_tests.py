#!/usr/bin/env python
"""
Test runner for events functionality tests.
Run this script to execute all events-related tests.
"""

import os
import sys
import django
from django.conf import settings
from django.test.utils import get_runner

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'academia_blockchain.settings')
django.setup()

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
    print("Running Events Tests...")
    print("=" * 50)
    
    failures = run_events_tests()
    
    if failures:
        print(f"\n❌ {failures} test(s) failed!")
        sys.exit(1)
    else:
        print("\n✅ All events tests passed!")
        sys.exit(0) 