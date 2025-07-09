"""
Sentry configuration for Sophia.AI Academia Blockchain application.
This file contains Sentry setup that can be easily integrated.
"""

import os
import logging
from django.conf import settings

# Sentry configuration (uncomment when Sentry is added)
# import sentry_sdk
# from sentry_sdk.integrations.django import DjangoIntegration
# from sentry_sdk.integrations.logging import LoggingIntegration

def configure_sentry():
    """
    Configure Sentry for error tracking and performance monitoring.
    Call this function in settings.py when ready to integrate Sentry.
    """
    # Uncomment and configure when Sentry is added to requirements.txt
    
    # sentry_logging = LoggingIntegration(
    #     level=logging.INFO,        # Capture info and above as breadcrumbs
    #     event_level=logging.ERROR  # Send errors as events
    # )
    
    # sentry_sdk.init(
    #     dsn=os.environ.get("SENTRY_DSN"),
    #     environment=os.environ.get("ENVIRONMENT", "development"),
    #     integrations=[
    #         DjangoIntegration(),
    #         sentry_logging,
    #     ],
    #     # Set traces_sample_rate to 1.0 to capture 100%
    #     # of transactions for performance monitoring.
    #     # We recommend adjusting this value in production.
    #     traces_sample_rate=1.0,
    #     # If you wish to associate users to errors (assuming you are using
    #     # django.contrib.auth) you may enable this PII data.
    #     send_default_pii=True,
    #     # Set sampling rate for profiling - this is relative to traces_sample_rate
    #     profiles_sample_rate=1.0,
    # )
    
    pass


def add_sentry_to_logging():
    """
    Add Sentry handler to Django logging configuration.
    This ensures all logged errors are sent to Sentry.
    """
    # When Sentry is integrated, add this to LOGGING configuration:
    
    # "handlers": {
    #     # ... existing handlers ...
    #     "sentry": {
    #         "class": "raven.contrib.django.raven_compat.handlers.SentryHandler",
    #         "level": "ERROR",
    #     },
    # },
    # "loggers": {
    #     # ... existing loggers ...
    #     "django": {
    #         "handlers": ["console", "file", "sentry"],
    #         "level": "INFO",
    #         "propagate": False,
    #     },
    #     "django.request": {
    #         "handlers": ["console", "file", "error_file", "sentry"],
    #         "level": "INFO",
    #         "propagate": False,
    #     },
    # }
    
    pass


# Sentry middleware for additional context
class SentryUserMiddleware:
    """
    Middleware to add user context to Sentry events.
    Add this to MIDDLEWARE when Sentry is integrated.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # When Sentry is integrated:
        # if hasattr(request, 'user') and request.user.is_authenticated:
        #     sentry_sdk.set_user({
        #         "id": request.user.id,
        #         "username": request.user.username,
        #         "email": getattr(request.user, 'email', None),
        #     })
        
        response = self.get_response(request)
        return response 