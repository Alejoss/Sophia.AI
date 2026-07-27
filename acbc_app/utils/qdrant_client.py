"""Qdrant Cloud client for Sophia (search / collection health).

Vectors are written by an external embed worker. Django only:
- tracks ContentTranscript.embedding_* bookkeeping via embedding-ingest ack
- queries Qdrant for topic RAG / similarity search
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 30.0
DEFAULT_VECTOR_SIZE = 3072  # text-embedding-3-large full dims
DEFAULT_DISTANCE = 'Cosine'


class QdrantClientError(RuntimeError):
    def __init__(self, message: str, *, status_code: Optional[int] = None, body: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


def qdrant_configured() -> bool:
    return bool(
        (getattr(settings, 'QDRANT_URL', '') or '').strip()
        and (getattr(settings, 'QDRANT_API_KEY', '') or '').strip()
    )


class QdrantClient:
    """Minimal REST client against Qdrant Cloud."""

    def __init__(
        self,
        *,
        url: Optional[str] = None,
        api_key: Optional[str] = None,
        collection: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
        session: Optional[requests.Session] = None,
    ):
        self.base_url = (url or getattr(settings, 'QDRANT_URL', '') or '').strip().rstrip('/')
        self.api_key = (api_key or getattr(settings, 'QDRANT_API_KEY', '') or '').strip()
        self.collection = (
            collection
            or getattr(settings, 'QDRANT_COLLECTION', '')
            or 'sophia_acbc_topic_chunks'
        ).strip()
        self.timeout = timeout
        self.session = session or requests.Session()
        if not self.base_url or not self.api_key:
            raise QdrantClientError(
                'Qdrant no configurado. Define QDRANT_URL y QDRANT_API_KEY en acbc_app/.env'
            )

    def _headers(self) -> dict[str, str]:
        return {
            'api-key': self.api_key,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: Optional[dict[str, Any]] = None,
    ) -> Any:
        url = f'{self.base_url}{path}'
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
            raise QdrantClientError(
                f'{method} {path} → {response.status_code}: {detail}',
                status_code=response.status_code,
                body=detail,
            )
        if response.status_code == 204 or not (response.content or b'').strip():
            return None
        return response.json()

    def health(self) -> dict[str, Any]:
        """GET / — cluster root / readiness style check via collections list."""
        data = self._request('GET', '/collections')
        collections = ((data or {}).get('result') or {}).get('collections') or []
        names = [c.get('name') for c in collections if isinstance(c, dict)]
        return {
            'ok': True,
            'url': self.base_url,
            'collection': self.collection,
            'collection_exists': self.collection in names,
            'collections': names,
        }

    def collection_exists(self) -> bool:
        response = self.session.get(
            f'{self.base_url}/collections/{self.collection}',
            headers=self._headers(),
            timeout=self.timeout,
        )
        if response.status_code == 200:
            return True
        if response.status_code == 404:
            return False
        detail: Any
        try:
            detail = response.json()
        except Exception:
            detail = (response.text or '').strip()[:800]
        raise QdrantClientError(
            f'GET /collections/{self.collection} → {response.status_code}: {detail}',
            status_code=response.status_code,
            body=detail,
        )

    def ensure_collection(
        self,
        *,
        vector_size: int = DEFAULT_VECTOR_SIZE,
        distance: str = DEFAULT_DISTANCE,
    ) -> bool:
        """
        Create the collection if missing.
        Returns True if created, False if it already existed.
        """
        if self.collection_exists():
            return False
        logger.info(
            'Creating Qdrant collection %s (size=%s, distance=%s)',
            self.collection,
            vector_size,
            distance,
        )
        self._request(
            'PUT',
            f'/collections/{self.collection}',
            json_body={
                'vectors': {
                    'size': int(vector_size),
                    'distance': distance,
                }
            },
        )
        return True

    def count_topic(self, topic_id: int) -> int:
        data = self._request(
            'POST',
            f'/collections/{self.collection}/points/count',
            json_body={
                'filter': {
                    'must': [{'key': 'topic_id', 'match': {'value': int(topic_id)}}]
                },
                'exact': True,
            },
        )
        result = (data or {}).get('result') or {}
        return int(result.get('count') or 0)

    def search(
        self,
        vector: list[float],
        *,
        topic_id: Optional[int] = None,
        limit: int = 8,
        with_payload: bool = True,
    ) -> list[dict[str, Any]]:
        body: dict[str, Any] = {
            'vector': vector,
            'limit': max(1, min(int(limit), 64)),
            'with_payload': with_payload,
        }
        if topic_id is not None:
            body['filter'] = {
                'must': [{'key': 'topic_id', 'match': {'value': int(topic_id)}}]
            }
        data = self._request(
            'POST',
            f'/collections/{self.collection}/points/search',
            json_body=body,
        )
        return list((data or {}).get('result') or [])
