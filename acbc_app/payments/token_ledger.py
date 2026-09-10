"""Idempotent platform-token credits and debits."""
from __future__ import annotations

import logging

from django.db import transaction
from django.db.models import F

from payments.models import TokenLedgerEntry, TokenPurchase
from profiles.models import Profile

logger = logging.getLogger(__name__)


class InsufficientTokenBalance(Exception):
    """User does not hold enough platform tokens for the spend."""

    def __init__(self, *, required: int, available: int):
        self.required = required
        self.available = available
        super().__init__(
            f'Saldo insuficiente: se necesitan {required} tokens y tienes {available}.'
        )


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


def debit_platform_tokens(
    *,
    user,
    amount: int,
    reason: str = TokenLedgerEntry.REASON_SPEND,
    anchor_request=None,
) -> TokenLedgerEntry:
    """
    Debit `amount` tokens from `user` and append a negative ledger row.

    Spends linked to a TranscriptAnchorRequest are unique so retries are safe.
    """
    if amount <= 0:
        raise ValueError('El débito de tokens debe ser positivo.')
    if reason not in dict(TokenLedgerEntry.REASON_CHOICES):
        raise ValueError('Motivo de ledger de tokens no válido.')

    with transaction.atomic():
        profile = Profile.objects.select_for_update().get(user_id=user.pk)

        if (
            reason == TokenLedgerEntry.REASON_SPEND
            and anchor_request is not None
        ):
            existing = (
                TokenLedgerEntry.objects.filter(
                    anchor_request=anchor_request,
                    reason=TokenLedgerEntry.REASON_SPEND,
                )
                .first()
            )
            if existing:
                return existing

        if profile.token_balance < amount:
            raise InsufficientTokenBalance(
                required=amount,
                available=profile.token_balance,
            )

        entry = TokenLedgerEntry.objects.create(
            user=user,
            delta=-amount,
            reason=reason,
            anchor_request=anchor_request,
        )
        Profile.objects.filter(pk=profile.pk).update(
            token_balance=F('token_balance') - amount,
        )
        logger.info(
            'Platform tokens debited user=%s amount=%s reason=%s anchor_request=%s',
            user.pk,
            amount,
            reason,
            getattr(anchor_request, 'pk', None),
        )
        return entry
