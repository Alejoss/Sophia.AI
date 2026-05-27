"""
Hooks invoked when NOWPayments reports a successful payment.

Extend `on_crypto_payment_completed` or connect to the Django signal below.
"""

import logging

from django.dispatch import Signal

logger = logging.getLogger(__name__)

# Connect from any app: crypto_payment_completed.connect(my_handler)
crypto_payment_completed = Signal()


def on_crypto_payment_completed(crypto_payment, registration):
    """
    Called once when a registration transitions to PAID via the crypto gateway.
    Safe place for certificates, emails, analytics, etc.
    """
    logger.info(
        'Crypto payment completed: order=%s registration=%s event=%s',
        crypto_payment.order_id,
        registration.id,
        registration.event_id,
    )
    crypto_payment_completed.send(
        sender=type(crypto_payment),
        crypto_payment=crypto_payment,
        registration=registration,
    )
