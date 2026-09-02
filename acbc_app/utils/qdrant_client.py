"""Qdrant Cloud client for Sophia (search / collection health).

Vectors are written by an external embed worker. Django only:
- tracks ContentTranscript.embedding_* bookkeeping via embedding-ingest ack
- queries Qdrant for topic RAG / similarity search
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

import requests
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 30.0
DEFAULT_VECTOR_SIZE = 3072  # text-embedding-3-large full dims
DEFAULT_DISTANCE = 'Cosine'
MAX_REQUEST_ATTEMPTS = 3


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
        self._owns_session = session is None
        self.session = session or self._build_session()
        if not self.base_url or not self.api_key:
            raise QdrantClientError(
                'Qdrant no configurado. Define QDRANT_URL y QDRANT_API_KEY en acbc_app/.env'
            )

    @staticmethod
    def _build_session() -> requests.Session:
        session = requests.Session()
        retry = Retry(
            total=2,
            connect=2,
            read=1,
            backoff_factor=0.3,
            status_forcelist=(429, 502, 503, 504),
            allowed_methods=frozenset(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount('https://', adapter)
        session.mount('http://', adapter)
        return session

    def _reset_session(self) -> None:
        """Drop pooled sockets after a RST so the next attempt opens a new TLS session."""
        if not self._owns_session:
            return
        try:
            self.session.close()
        except Exception:
            logger.debug('Could not close Qdrant session after connection error', exc_info=True)
        self.session = self._build_session()

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
        last_error: Optional[BaseException] = None
        for attempt in range(1, MAX_REQUEST_ATTEMPTS + 1):
            try:
                response = self.session.request(
                    method,
                    url,
                    headers=self._headers(),
                    json=json_body,
                    timeout=self.timeout,
                )
            except requests.RequestException as exc:
                last_error = exc
                logger.warning(
                    'Qdrant %s %s connection error attempt=%s/%s: %s',
                    method,
                    path,
                    attempt,
                    MAX_REQUEST_ATTEMPTS,
                    exc,
                )
                self._reset_session()
                if attempt >= MAX_REQUEST_ATTEMPTS:
                    raise QdrantClientError(
                        f'No se pudo conectar a Qdrant ({method} {path}).',
                    ) from exc
                time.sleep(0.25 * attempt)
                continue

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

        raise QdrantClientError(
            f'No se pudo conectar a Qdrant ({method} {path}).',
        ) from last_error

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
        try:
            self._request('GET', f'/collections/{self.collection}')
            return True
        except QdrantClientError as exc:
            if exc.status_code == 404:
                return False
            raise

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
