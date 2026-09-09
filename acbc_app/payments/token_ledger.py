"""Idempotent platform-token credits. Debits land here in a later checkout phase."""
from __future__ import annotations

import logging

from django.db import transaction
from django.db.models import F

from payments.models import TokenLedgerEntry, TokenPurchase
from profiles.models import Profile

logger = logging.getLogger(__name__)


def credit_platform_tokens(
    *,
    user,
    amount: int,
    reason: str,
    token_purchase: TokenPurchase | None = None,
) -> TokenLedgerEntry:
    """
    Credit `amount` tokens to `user` and append a ledger row.

    Purchase credits are unique on (token_purchase, reason=purchase), so a
    second NOWPayments IPN or BCH verify cannot double-credit.
    """
    if amount <= 0:
        raise ValueError('El crédito de tokens debe ser positivo.')
    if reason not in dict(TokenLedgerEntry.REASON_CHOICES):
        raise ValueError('Motivo de ledger de tokens no válido.')

    with transaction.atomic():
        profile = Profile.objects.select_for_update().get(user_id=user.pk)
        if (
            reason == TokenLedgerEntry.REASON_PURCHASE
            and token_purchase is not None
        ):
            existing = (
                TokenLedgerEntry.objects.filter(
                    token_purchase=token_purchase,
                    reason=TokenLedgerEntry.REASON_PURCHASE,
                )
                .first()
            )
            if existing:
                return existing

        entry = TokenLedgerEntry.objects.create(
            user=user,
            delta=amount,
            reason=reason,
            token_purchase=token_purchase,
        )
        Profile.objects.filter(pk=profile.pk).update(
            token_balance=F('token_balance') + amount,
        )
        logger.info(
            'Platform tokens credited user=%s amount=%s reason=%s purchase=%s',
            user.pk,
            amount,
            reason,
            getattr(token_purchase, 'pk', None),
        )
        return entry
