"""
Hooks invoked when NOWPayments reports a successful payment.

Extend `on_crypto_payment_completed` or connect to the Django signal below.
"""

import logging

from django.dispatch import Signal

logger = logging.getLogger(__name__)

# Connect from any app: crypto_payment_completed.connect(my_handler)
crypto_payment_completed = Signal()


def on_crypto_payment_completed(crypto_payment, event_registration=None, path_purchase=None):
    """
    Called once when an entitlement transitions to PAID via the crypto gateway.
    Safe place for certificates, emails, analytics, unlocks, etc.
    """
    if event_registration is not None:
        logger.info(
            'Crypto payment completed: order=%s event_registration=%s event=%s',
            crypto_payment.order_id,
            event_registration.id,
            event_registration.event_id,
        )
    elif path_purchase is not None:
        logger.info(
            'Crypto payment completed: order=%s path_purchase=%s knowledge_path=%s',
            crypto_payment.order_id,
            path_purchase.id,
            path_purchase.knowledge_path_id,
        )
    else:
        logger.info('Crypto payment completed: order=%s', crypto_payment.order_id)

    crypto_payment_completed.send(
        sender=type(crypto_payment),
        crypto_payment=crypto_payment,
        event_registration=event_registration,
        path_purchase=path_purchase,
        # Backwards-compatible kwarg for existing listeners
        registration=event_registration,
    )
