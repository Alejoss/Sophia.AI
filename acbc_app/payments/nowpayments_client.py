"""Thin client for the NOWPayments REST API (BCH, XMR, etc.)."""

import hashlib
import hmac
import json
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class NOWPaymentsError(Exception):
    def __init__(self, message, status_code=None, payload=None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload or {}


class NOWPaymentsClient:
    def __init__(self):
        self.api_key = getattr(settings, 'NOWPAYMENTS_API_KEY', '') or ''
        self.base_url = getattr(settings, 'NOWPAYMENTS_API_URL', 'https://api.nowpayments.io/v1').rstrip('/')
        self.ipn_secret = getattr(settings, 'NOWPAYMENTS_IPN_SECRET', '') or ''

    @property
    def configured(self):
        return bool(self.api_key)

    def _headers(self):
        return {
            'x-api-key': self.api_key,
            'Content-Type': 'application/json',
        }

    def _request(self, method, path, **kwargs):
        if not self.configured:
            raise NOWPaymentsError('NOWPayments API key is not configured')
        url = f'{self.base_url}{path}'
        try:
            response = requests.request(method, url, headers=self._headers(), timeout=30, **kwargs)
        except requests.RequestException as exc:
            logger.error('NOWPayments request failed: %s %s — %s', method, path, exc)
            raise NOWPaymentsError(str(exc)) from exc

        if response.status_code >= 400:
            try:
                payload = response.json()
            except ValueError:
                payload = {'detail': response.text}
            logger.warning('NOWPayments error %s: %s', response.status_code, payload)
            raise NOWPaymentsError(
                payload.get('message') or payload.get('detail') or 'NOWPayments API error',
                status_code=response.status_code,
                payload=payload,
            )
        return response.json()

    def get_currencies(self):
        return self._request('GET', '/currencies')

    def get_estimate(self, amount, currency_from, currency_to):
        return self._request(
            'GET',
            '/estimate',
            params={
                'amount': amount,
                'currency_from': currency_from,
                'currency_to': currency_to,
            },
        )

    def create_payment(self, *, price_amount, price_currency, pay_currency, order_id,
                       order_description, ipn_callback_url):
        """
        POST /v1/payment — see NOWPayments API docs.
        success_url / cancel_url belong to POST /v1/invoice, not /payment.
        """
        body = {
            'price_amount': price_amount,
            'price_currency': price_currency,
            'pay_currency': pay_currency,
            'order_id': order_id,
            'order_description': order_description,
            'ipn_callback_url': ipn_callback_url,
        }
        return self._request('POST', '/payment', json=body)

    def get_payment_status(self, payment_id):
        return self._request('GET', f'/payment/{payment_id}')

    @staticmethod
    def sort_params(obj):
        """Recursively sort dict keys (required for IPN HMAC per NOWPayments docs)."""
        if isinstance(obj, dict):
            return {key: NOWPaymentsClient.sort_params(obj[key]) for key in sorted(obj.keys())}
        if isinstance(obj, list):
            return [NOWPaymentsClient.sort_params(item) for item in obj]
        return obj

    def verify_ipn_signature(self, body: dict, signature: str) -> bool:
        if not self.ipn_secret or not signature:
            return False
        sorted_body = json.dumps(
            self.sort_params(body),
            separators=(',', ':'),
            ensure_ascii=True,
        )
        digest = hmac.new(
            self.ipn_secret.encode('utf-8'),
            sorted_body.encode('utf-8'),
            hashlib.sha512,
        ).hexdigest()
        return hmac.compare_digest(digest, signature)
