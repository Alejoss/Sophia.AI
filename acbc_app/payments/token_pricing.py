"""Convert USD prices to platform-token amounts (face value + optional discount)."""
from __future__ import annotations

import math
from decimal import Decimal

from django.conf import settings


def platform_token_unit_usd() -> Decimal:
    return Decimal(str(getattr(settings, 'PLATFORM_TOKEN_USD_PRICE', '0.01') or '0.01')).quantize(
        Decimal('0.01')
    )


def tokens_required_for_usd(usd_amount) -> int:
    """
    Tokens needed to pay ``usd_amount`` at face value, after TOKEN_CONTENT_DISCOUNT_PERCENT.

    Example: $1 at $0.01/token → 100 tokens (0% discount).
    """
    usd = Decimal(str(usd_amount or 0))
    if usd <= 0:
        return 0
    unit = platform_token_unit_usd()
    if unit <= 0:
        raise ValueError('PLATFORM_TOKEN_USD_PRICE must be positive.')
    raw = int(math.ceil(usd / unit))
    discount = int(getattr(settings, 'TOKEN_CONTENT_DISCOUNT_PERCENT', 0) or 0)
    discount = max(0, min(discount, 100))
    if discount:
        raw = int(math.ceil(raw * (100 - discount) / 100))
    return max(1, raw)
