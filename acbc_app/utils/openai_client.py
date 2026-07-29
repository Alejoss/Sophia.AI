"""Minimal OpenAI REST client (embeddings + chat) via requests."""

from __future__ import annotations

import logging
from typing import Any, Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 60.0
OPENAI_API_BASE = 'https://api.openai.com/v1'


class OpenAIClientError(RuntimeError):
    def __init__(self, message: str, *, status_code: Optional[int] = None, body: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


def openai_configured() -> bool:
    return bool((getattr(settings, 'OPENAI_API_KEY', '') or '').strip())


class OpenAIClient:
    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
        session: Optional[requests.Session] = None,
    ):
        self.api_key = (api_key or getattr(settings, 'OPENAI_API_KEY', '') or '').strip()
        self.timeout = timeout
        self.session = session or requests.Session()
        if not self.api_key:
            raise OpenAIClientError(
                'OpenAI no configurado. Define OPENAI_API_KEY en acbc_app/.env'
            )

    def _headers(self) -> dict[str, str]:
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
        }

    def _request(self, method: str, path: str, json_body: dict[str, Any]) -> Any:
        url = f'{OPENAI_API_BASE}{path}'
        response = self.session.request(
            method,
            url,
            headers=self._headers(),
            json=json_body,
            timeout=self.timeout,
        )
        if response.status_code >= 400:
            detail: Any
            try:
                detail = response.json()
            except Exception:
                detail = (response.text or '').strip()[:800]
            raise OpenAIClientError(
                f'{method} {path} → {response.status_code}: {detail}',
                status_code=response.status_code,
                body=detail,
            )
        return response.json()

    def embed(
        self,
        text: str,
        *,
        model: Optional[str] = None,
    ) -> list[float]:
        model_name = (
            model
            or getattr(settings, 'OPENAI_EMBEDDING_MODEL', '')
            or 'text-embedding-3-large'
        )
        data = self._request(
            'POST',
            '/embeddings',
            {
                'model': model_name,
                'input': text,
            },
        )
        items = (data or {}).get('data') or []
        if not items:
            raise OpenAIClientError('OpenAI embeddings no devolvió vectores.')
        embedding = items[0].get('embedding')
        if not isinstance(embedding, list) or not embedding:
            raise OpenAIClientError('OpenAI embeddings devolvió un vector vacío.')
        return list(embedding)

    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
    ) -> str:
        model_name = (
            model
            or getattr(settings, 'OPENAI_CHAT_MODEL', '')
            or 'gpt-4o-mini'
        )
        body: dict[str, Any] = {
            'model': model_name,
            'messages': messages,
            'temperature': temperature,
        }
        if max_tokens is not None:
            body['max_tokens'] = max_tokens
        data = self._request('POST', '/chat/completions', body)
        choices = (data or {}).get('choices') or []
        if not choices:
            raise OpenAIClientError('OpenAI chat no devolvió choices.')
        message = (choices[0].get('message') or {})
        content = (message.get('content') or '').strip()
        if not content:
            raise OpenAIClientError('OpenAI chat devolvió una respuesta vacía.')
        return content
