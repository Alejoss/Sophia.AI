"""Fee budget helpers for transcript OP_RETURN broadcasts."""
from __future__ import annotations

import logging
from typing import Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

SATS_PER_BTC = 100_000_000
FEE_TOO_HIGH_MESSAGE = (
    'Las comisiones por transacción están muy altas por el momento, '
    'por favor vuelve a intentarlo más tarde'
)
_PRICE_TIMEOUT = 15
_MEMPOOL_PRICES_URL = 'https://mempool.space/api/v1/prices'


class FeeBudgetError(Exception):
    """Raised when the estimated fee exceeds the configured USD cap."""

    def __init__(self, message: str = FEE_TOO_HIGH_MESSAGE, *, fee_sats: int = 0, fee_usd: float = 0.0):
        super().__init__(message)
        self.fee_sats = fee_sats
        self.fee_usd = fee_usd


def fee_sats_to_usd(fee_sats: int, btc_usd: float) -> float:
    return (max(0, int(fee_sats)) / SATS_PER_BTC) * float(btc_usd)


def resolve_btc_usd_price(*, session: Optional[requests.Session] = None) -> float:
    """
    USD/BTC for fee budgeting.

    Prefer ``settings.BTC_USD_PRICE`` when set (> 0); otherwise fetch mempool.space
    prices synchronously.
    """
    configured = float(getattr(settings, 'BTC_USD_PRICE', 0) or 0)
    if configured > 0:
        return configured

    sess = session or requests.Session()
    try:
        response = sess.get(_MEMPOOL_PRICES_URL, timeout=_PRICE_TIMEOUT)
    except requests.RequestException as exc:
        raise FeeBudgetError(
            'No se pudo obtener el precio de Bitcoin para validar la comisión.'
        ) from exc
    if response.status_code >= 400:
        raise FeeBudgetError(
            'No se pudo obtener el precio de Bitcoin para validar la comisión.'
        )
    data = response.json()
    usd = data.get('USD') if isinstance(data, dict) else None
    if usd is None or float(usd) <= 0:
        raise FeeBudgetError(
            'No se pudo obtener el precio de Bitcoin para validar la comisión.'
        )
    return float(usd)


def assert_fee_within_usd_budget(
    fee_sats: int,
    *,
    btc_usd: Optional[float] = None,
    session: Optional[requests.Session] = None,
) -> float:
    """
    Raise ``FeeBudgetError`` if fee cost in USD exceeds ``BTC_MAX_FEE_USD``.

    Returns the USD cost when within budget. Cap ``<= 0`` disables the check.
    """
    max_usd = float(getattr(settings, 'BTC_MAX_FEE_USD', 1.0) or 0)
    if max_usd <= 0:
        return 0.0

    price = float(btc_usd) if btc_usd is not None else resolve_btc_usd_price(session=session)
    fee_usd = fee_sats_to_usd(fee_sats, price)
    if fee_usd > max_usd:
        logger.info(
            'Rejecting broadcast: fee_sats=%s fee_usd=%.4f max_usd=%.2f btc_usd=%.2f',
            fee_sats,
            fee_usd,
            max_usd,
            price,
        )
        raise FeeBudgetError(fee_sats=fee_sats, fee_usd=fee_usd)
    return fee_usd
