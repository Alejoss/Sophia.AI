"""Thin client for Payphone Botón de pago (Prepare + Confirm)."""

from __future__ import annotations

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class PayphoneError(Exception):
    def __init__(self, message, status_code=None, payload=None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload or {}


class PayphoneClient:
    """Payphone Button API: https://docs.payphone.app/boton-de-pago"""

    def __init__(self):
        self.token = getattr(settings, 'PAYPHONE_TOKEN', '') or ''
        self.store_id = getattr(settings, 'PAYPHONE_STORE_ID', '') or ''
        self.base_url = getattr(
            settings,
            'PAYPHONE_API_URL',
            'https://pay.payphonetodoesposible.com/api',
        ).rstrip('/')

    @property
    def configured(self) -> bool:
        return bool(self.token and self.store_id)

    def _headers(self) -> dict:
        return {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json',
        }

    def _request(self, method: str, path: str, **kwargs):
        if not self.configured:
            raise PayphoneError('Payphone no está configurado (faltan TOKEN o STORE_ID).')
        url = f'{self.base_url}{path}'
        try:
            response = requests.request(
                method, url, headers=self._headers(), timeout=30, **kwargs,
            )
        except requests.RequestException as exc:
            logger.error('Payphone request failed: %s %s — %s', method, path, exc)
            raise PayphoneError(str(exc)) from exc

        try:
            payload = response.json()
        except ValueError:
            payload = {'detail': response.text}

        if response.status_code >= 400:
            log_fn = logger.error if response.status_code >= 500 else logger.warning
            log_fn(
                'Payphone error %s %s %s: %s',
                method, path, response.status_code, payload,
            )
            message = (
                payload.get('message')
                or payload.get('detail')
                or 'Error de la API de Payphone'
            )
            raise PayphoneError(message, status_code=response.status_code, payload=payload)
        return payload

    def prepare(
        self,
        *,
        amount: int,
        client_transaction_id: str,
        response_url: str,
        reference: str,
        cancellation_url: str = '',
        amount_without_tax: int | None = None,
        amount_with_tax: int | None = None,
        tax: int | None = None,
        currency: str = 'USD',
        lang: str = 'es',
        email: str = '',
        phone_number: str = '',
        optional_parameter: str = '',
    ) -> dict:
        """
        POST /button/Prepare — returns paymentId, payWithCard, payWithPayPhone.

        Amounts are integers in cents (USD × 100).
        """
        body = {
            'amount': int(amount),
            'clientTransactionId': client_transaction_id,
            'currency': currency,
            'storeId': self.store_id,
            'reference': reference,
            'responseUrl': response_url,
            'lang': lang,
        }
        if amount_without_tax is not None:
            body['amountWithoutTax'] = int(amount_without_tax)
        if amount_with_tax is not None:
            body['amountWithTax'] = int(amount_with_tax)
        if tax is not None:
            body['tax'] = int(tax)
        if cancellation_url:
            body['cancellationUrl'] = cancellation_url
        if email:
            body['email'] = email
        if phone_number:
            body['phoneNumber'] = phone_number
        if optional_parameter:
            body['optionalParameter'] = optional_parameter

        timezone_offset = getattr(settings, 'PAYPHONE_TIMEZONE_OFFSET', -5)
        if timezone_offset is not None:
            body['timeZone'] = int(timezone_offset)

        return self._request('POST', '/button/Prepare', json=body)

    def confirm(self, *, transaction_id: int, client_transaction_id: str) -> dict:
        """POST /button/V2/Confirm — must run within 5 minutes of payment."""
        body = {
            'id': int(transaction_id),
            'clientTxId': client_transaction_id,
        }
        return self._request('POST', '/button/V2/Confirm', json=body)
