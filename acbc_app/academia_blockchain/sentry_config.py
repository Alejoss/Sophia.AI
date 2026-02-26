"""
Sentry configuration for Sophia.AI Academia Blockchain application.
Initializes when SENTRY_DSN is set (e.g. production / beta).
"""

import os
import logging


def configure_sentry():
    """
    Configure Sentry for error tracking and performance monitoring.
    Call from settings.py when SENTRY_DSN is set.
    """
    dsn = os.environ.get("SENTRY_DSN", "").strip()
    if not dsn:
        return

    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    sentry_logging = LoggingIntegration(
        level=logging.INFO,        # Capture info and above as breadcrumbs
        event_level=logging.ERROR  # Send errors as events
    )

    env = os.environ.get("ENVIRONMENT", "development")
    # Lower sample rates in production to control volume; use 1.0 for beta if desired
    traces_sample_rate = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
    profiles_sample_rate = float(os.environ.get("SENTRY_PROFILES_SAMPLE_RATE", "0.0"))

    sentry_sdk.init(
        dsn=dsn,
        environment=env,
        integrations=[
            DjangoIntegration(),
            sentry_logging,
        ],
        traces_sample_rate=traces_sample_rate,
        profiles_sample_rate=profiles_sample_rate,
        send_default_pii=True,
    )


class SentryUserMiddleware:
    """
    Middleware to add user context to Sentry events.
    Only sets user when Sentry is initialized (SENTRY_DSN set).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if os.environ.get("SENTRY_DSN", "").strip():
            try:
                import sentry_sdk
                if hasattr(request, 'user') and request.user.is_authenticated:
                    sentry_sdk.set_user({
                        "id": request.user.id,
                        "username": request.user.username,
                        "email": getattr(request.user, 'email', None) or "",
                    })
            except Exception:
                pass
        response = self.get_response(request)
        return response
