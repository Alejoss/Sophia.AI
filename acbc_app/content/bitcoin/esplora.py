"""Esplora-compatible HTTP client (mempool.space)."""
from __future__ import annotations

import logging
import os
from typing import Any

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 30

# Public mempool.space bases keyed by TranscriptAnchor.btc_network.
NETWORK_API_DEFAULTS = {
    'signet': 'https://mempool.space/signet/api',
    'testnet': 'https://mempool.space/testnet/api',
    'testnet4': 'https://mempool.space/testnet4/api',
    'mainnet': 'https://mempool.space/api',
}


class BitcoinApiError(Exception):
    """Raised when the public Bitcoin API request fails."""


def api_base_for_network(network: str) -> str:
    """
    Resolve Esplora API base for a specific Bitcoin network.

    A process-wide ``BTC_API_BASE`` override applies only when it targets the
    configured ``BTC_NETWORK``. Historical rows on another network always use
    that network's default public endpoint (or raise if unsupported).
    """
    network = (network or '').strip().lower()
    if not network:
        raise BitcoinApiError('btc_network is required to select an Esplora API')

    env_override = (os.getenv('BTC_API_BASE') or '').strip().rstrip('/')
    configured_network = (getattr(settings, 'BTC_NETWORK', '') or '').strip().lower()
    if env_override and network == configured_network:
        return env_override

    base = NETWORK_API_DEFAULTS.get(network)
    if not base:
        raise BitcoinApiError(f'No Esplora API base configured for network={network}')
    return base.rstrip('/')


def client_for_network(
    network: str,
    *,
    session: requests.Session | None = None,
) -> 'EsploraClient':
    return EsploraClient(api_base=api_base_for_network(network), session=session)


class EsploraClient:
    def __init__(self, api_base: str | None = None, session: requests.Session | None = None):
        self.api_base = (api_base or settings.BTC_API_BASE).rstrip('/')
        self.session = session or requests.Session()

    def _get(self, path: str, *, allow_404: bool = False) -> Any:
        url = f'{self.api_base}{path}'
        try:
            response = self.session.get(url, timeout=DEFAULT_TIMEOUT)
        except requests.RequestException as exc:
            raise BitcoinApiError(f'GET {url} failed: {exc}') from exc
        if response.status_code == 404 and allow_404:
            return None
        if response.status_code >= 400:
            raise BitcoinApiError(f'GET {url} → {response.status_code}: {response.text[:300]}')
        if 'application/json' in response.headers.get('Content-Type', ''):
            return response.json()
        return response.text

    def _post_text(self, path: str, body: str) -> str:
        url = f'{self.api_base}{path}'
        try:
            response = self.session.post(
                url,
                data=body,
                headers={'Content-Type': 'text/plain'},
                timeout=DEFAULT_TIMEOUT,
            )
        except requests.RequestException as exc:
            raise BitcoinApiError(f'POST {url} failed: {exc}') from exc
        if response.status_code >= 400:
            raise BitcoinApiError(f'POST {url} → {response.status_code}: {response.text[:300]}')
        return response.text.strip()

    def get_address_utxos(self, address: str) -> list[dict]:
        data = self._get(f'/address/{address}/utxo')
        if not isinstance(data, list):
            raise BitcoinApiError('Unexpected UTXO response')
        return data

    def get_recommended_fee_sat_vb(self) -> int:
        """
        Prefer economy/hourFee-style rates so test anchors stay cheap.
        Falls back to settings.BTC_FALLBACK_FEE_SAT_VB.
        """
        try:
            data = self._get('/v1/fees/recommended')
            for key in ('hourFee', 'economyFee', 'halfHourFee', 'fastestFee'):
                if key in data and data[key]:
                    return max(1, int(data[key]))
        except BitcoinApiError as exc:
            logger.warning('Fee estimate unavailable (%s); using fallback', exc)
        return max(1, int(getattr(settings, 'BTC_FALLBACK_FEE_SAT_VB', 25)))

    def get_tip_height(self) -> int:
        data = self._get('/blocks/tip/height')
        return int(data)

    def broadcast(self, raw_tx_hex: str) -> str:
        """Broadcast raw transaction hex; returns txid."""
        return self._post_text('/tx', raw_tx_hex)

    def get_tx_status(self, txid: str) -> dict:
        data = self._get(f'/tx/{txid}')
        if not isinstance(data, dict):
            raise BitcoinApiError('Unexpected tx response')
        return data

    def get_tx_or_none(self, txid: str) -> dict | None:
        """Return tx JSON if known to the explorer, else None (404)."""
        data = self._get(f'/tx/{txid}', allow_404=True)
        if data is None:
            return None
        if not isinstance(data, dict):
            raise BitcoinApiError('Unexpected tx response')
        return data
