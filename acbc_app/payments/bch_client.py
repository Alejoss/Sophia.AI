"""Public Bitcoin Cash chain/price clients — on-demand verification only."""
from __future__ import annotations

import json
import logging
import socket
import ssl
import time
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Optional
from urllib.parse import urlparse

import requests
from django.conf import settings

from payments.bch_cashaddr import CashAddrError, address_prefix, address_to_scripthash

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 30
# Connect must fail fast so we can try the next Fulcrum / HTTP fallback.
ELECTRUM_CONNECT_TIMEOUT = 10
SATS_PER_BCH = 100_000_000
BLOCKCHAIR_MAINNET = 'https://api.blockchair.com/bitcoin-cash'
DEFAULT_MAINNET_ELECTRUM = 'ssl://bch.imaginary.cash:50002'
DEFAULT_CHIPNET_ELECTRUM = 'ssl://chipnet.bch.ninja:50002'
# Prod often sees intermittent connect timeouts on a single Fulcrum host.
DEFAULT_MAINNET_ELECTRUM_SERVERS = (
    'ssl://bch.imaginary.cash:50002',
    'ssl://electrum.imaginary.cash:50002',
    'ssl://blackie.c3-soft.com:50002',
    'ssl://bch.loping.net:50002',
)
DEFAULT_CHIPNET_ELECTRUM_SERVERS = (
    'ssl://chipnet.bch.ninja:50002',
)
COINGECKO_BCH_PRICE_URL = (
    'https://api.coingecko.com/api/v3/simple/price'
    '?ids=bitcoin-cash&vs_currencies=usd'
)


class BchApiError(Exception):
    """Raised when the public BCH API request fails."""


@dataclass
class BchTxOutput:
    address: str
    amount_sats: int


@dataclass
class BchTransaction:
    txid: str
    timestamp: Optional[int]  # unix seconds
    confirmations: int
    outputs: list[BchTxOutput]


def get_bch_network() -> str:
    return (getattr(settings, 'BCH_NETWORK', 'mainnet') or 'mainnet').strip().lower()


def get_bch_receive_address() -> str:
    """Pick receive address for the active network (chipnet vs mainnet overrides)."""
    network = get_bch_network()
    generic = (getattr(settings, 'BCH_RECEIVE_ADDRESS', '') or '').strip()
    if network == 'mainnet':
        specific = (getattr(settings, 'BCH_RECEIVE_ADDRESS_MAINNET', '') or '').strip()
    else:
        # chipnet / testnet / testnet4 share bchtest: prefix
        specific = (getattr(settings, 'BCH_RECEIVE_ADDRESS_CHIPNET', '') or '').strip()
    return specific or generic


def is_bch_direct_configured() -> bool:
    address = get_bch_receive_address()
    if not address:
        return False
    network = get_bch_network()
    try:
        prefix = address_prefix(address)
    except CashAddrError as exc:
        logger.error('BCH receive address is not valid CashAddr: %s (%s)', address, exc)
        return False
    if network == 'mainnet' and prefix not in ('bitcoincash', 'bchreg'):
        logger.warning(
            'BCH receive address prefix %r does not match BCH_NETWORK=mainnet',
            prefix,
        )
    if network != 'mainnet' and prefix not in ('bchtest', 'bchreg'):
        logger.warning(
            'BCH receive address prefix %r does not match BCH_NETWORK=%s '
            '(chipnet/testnet expect bchtest:)',
            prefix,
            network,
        )
    return True


def _electrum_server_list(*, network: str, api_base: str) -> list[str]:
    """Ordered Fulcrum endpoints: env list, else defaults (api_base first)."""
    configured = (getattr(settings, 'BCH_ELECTRUM_SERVERS', '') or '').strip()
    if configured:
        servers = [s.strip() for s in configured.split(',') if s.strip()]
        if servers:
            return servers
    if network == 'mainnet':
        defaults = list(DEFAULT_MAINNET_ELECTRUM_SERVERS)
        primary = api_base or DEFAULT_MAINNET_ELECTRUM
    else:
        defaults = list(DEFAULT_CHIPNET_ELECTRUM_SERVERS)
        primary = api_base or DEFAULT_CHIPNET_ELECTRUM
    ordered: list[str] = []
    for candidate in [primary, *defaults]:
        if candidate and candidate not in ordered:
            ordered.append(candidate)
    return ordered


def build_bch_client(
    session: requests.Session | None = None,
) -> 'BchPublicClient | BchElectrumClient | BchFailoverClient':
    """
    Default: Fulcrum/Electrum SSL with multi-server + Blockchair HTTP failover.
    Explicit ``https://…blockchair.com…`` → Blockchair HTTP only (optional API key).
    """
    network = get_bch_network()
    api_base = (getattr(settings, 'BCH_API_BASE', '') or '').strip()
    if api_base.startswith('https://') and 'blockchair.com' in api_base:
        return BchPublicClient(api_base=api_base, session=session)
    if api_base.startswith('https://') and not api_base.startswith('ssl://'):
        # Legacy/custom HTTP explorer still using the Blockchair-shaped client.
        return BchPublicClient(api_base=api_base, session=session)
    servers = _electrum_server_list(network=network, api_base=api_base)
    http_fallback = None
    if network == 'mainnet':
        http_fallback = BchPublicClient(api_base=BLOCKCHAIR_MAINNET, session=session)
    return BchFailoverClient(servers=servers, http_fallback=http_fallback)


class BchPublicClient:
    """
    Thin Blockchair client (same HTTP style as NOWPayments/Esplora: requests).

    Override ``BCH_API_BASE`` if you self-host a compatible proxy.
    """

    def __init__(self, api_base: str | None = None, session: requests.Session | None = None):
        self.api_base = (
            api_base
            or getattr(settings, 'BCH_API_BASE', BLOCKCHAIR_MAINNET)
            or BLOCKCHAIR_MAINNET
        ).rstrip('/')
        self.session = session or requests.Session()

    def _get(self, path: str, params: dict | None = None) -> Any:
        url = f'{self.api_base}{path}'
        query = dict(params or {})
        api_key = (getattr(settings, 'BCH_BLOCKCHAIR_API_KEY', '') or '').strip()
        if api_key and 'key' not in query:
            query['key'] = api_key
        try:
            response = self.session.get(url, params=query or None, timeout=DEFAULT_TIMEOUT)
        except requests.RequestException as exc:
            logger.error('BCH HTTP GET %s failed: %s', url, exc, exc_info=True)
            raise BchApiError(f'GET {url} failed: {exc}') from exc
        if response.status_code >= 400:
            body = (response.text or '')[:500]
            logger.error(
                'BCH HTTP GET %s → %s body=%s',
                response.url,
                response.status_code,
                body,
            )
            raise BchApiError(
                f'GET {url} → {response.status_code}: {body[:300]}'
            )
        try:
            payload = response.json()
        except ValueError as exc:
            logger.error('BCH HTTP GET %s returned invalid JSON', response.url)
            raise BchApiError(f'Invalid JSON from {url}') from exc
        context = payload.get('context') if isinstance(payload, dict) else None
        if isinstance(context, dict) and context.get('error'):
            code = context.get('code')
            err = context.get('error')
            logger.error('BCH HTTP GET %s context error code=%s: %s', response.url, code, err)
            raise BchApiError(f'Blockchair error {code}: {err}')
        return payload

    def get_bch_usd_rate(self) -> Decimal:
        """USD price for 1 BCH."""
        configured = Decimal(str(getattr(settings, 'BCH_USD_PRICE', 0) or 0))
        if configured > 0:
            return configured
        try:
            data = self._get('/stats')
            price = (data.get('data') or {}).get('market_price_usd')
            if price is None:
                price = (data.get('context') or {}).get('market_price_usd')
            if price is not None and Decimal(str(price)) > 0:
                return Decimal(str(price))
        except BchApiError as exc:
            logger.warning('Blockchair BCH/USD rate failed, trying CoinGecko: %s', exc)
        return _fetch_coingecko_bch_usd_rate()

    def list_recent_transactions(
        self,
        address: str,
        *,
        limit: int = 25,
    ) -> list[BchTransaction]:
        """
        Fetch recent txs that touch ``address`` with output details.

        Prefers a single Blockchair address dashboard call with
        ``transaction_details=true``; falls back to per-tx lookups.
        """
        addr = (address or '').strip()
        if not addr:
            raise BchApiError('Address BCH vacía.')

        dashboard = self._get(
            f'/dashboards/address/{addr}',
            params={'limit': str(min(limit, 10)), 'transaction_details': 'true'},
        )
        addr_data = (dashboard.get('data') or {}).get(addr) or {}
        # Blockchair sometimes keys without prefix
        if not addr_data and ':' in addr:
            bare = addr.split(':', 1)[1]
            addr_data = (dashboard.get('data') or {}).get(bare) or {}
        tip = (dashboard.get('context') or {}).get('state')
        txs_raw = addr_data.get('transactions') or []
        if not txs_raw:
            return []

        results: list[BchTransaction] = []
        pending_txids: list[str] = []
        for item in txs_raw[:limit]:
            if isinstance(item, dict):
                try:
                    results.append(self._transaction_from_blockchair_detail(item, tip_height=tip))
                except BchApiError as exc:
                    logger.warning('Skip BCH dashboard tx detail: %s', exc)
                continue
            pending_txids.append(str(item))

        for txid in pending_txids[:limit]:
            try:
                results.append(self.get_transaction(txid, tip_height=tip))
            except BchApiError as exc:
                logger.warning('Skip BCH tx %s: %s', txid, exc)
        return results

    def _transaction_from_blockchair_detail(
        self,
        detail: dict,
        *,
        tip_height: int | None = None,
    ) -> BchTransaction:
        tx = detail.get('transaction') or detail
        txid = tx.get('hash') or detail.get('hash') or detail.get('txid')
        if not txid:
            raise BchApiError('Blockchair transaction detail missing hash')
        outputs_raw = detail.get('outputs') or []
        return self._parse_blockchair_tx(
            str(txid),
            tx,
            outputs_raw,
            tip_height=tip_height,
        )

    def get_transaction(
        self,
        txid: str,
        *,
        tip_height: int | None = None,
    ) -> BchTransaction:
        data = self._get(f'/dashboards/transaction/{txid}')
        tx_wrap = (data.get('data') or {}).get(txid) or {}
        tx = tx_wrap.get('transaction') or {}
        outputs_raw = tx_wrap.get('outputs') or []
        return self._parse_blockchair_tx(str(txid), tx, outputs_raw, tip_height=tip_height)

    def _parse_blockchair_tx(
        self,
        txid: str,
        tx: dict,
        outputs_raw: list,
        *,
        tip_height: int | None = None,
    ) -> BchTransaction:
        block_id = tx.get('block_id')
        confirmations = 0
        if block_id is not None and int(block_id) >= 0 and tip_height is not None:
            confirmations = max(0, int(tip_height) - int(block_id) + 1)
        elif block_id is not None and int(block_id) >= 0:
            confirmations = 1

        timestamp = tx.get('time')
        if isinstance(timestamp, str):
            # Blockchair returns "YYYY-MM-DD HH:MM:SS" UTC for some payloads.
            try:
                from datetime import datetime, timezone as dt_timezone

                timestamp = int(
                    datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
                    .replace(tzinfo=dt_timezone.utc)
                    .timestamp()
                )
            except ValueError:
                timestamp = None
        elif timestamp is not None:
            try:
                timestamp = int(timestamp)
            except (TypeError, ValueError):
                timestamp = None

        outputs: list[BchTxOutput] = []
        for out in outputs_raw:
            recipient = (
                out.get('recipient')
                or out.get('address')
                or ''
            )
            value = out.get('value')
            if value is None:
                continue
            try:
                amount_sats = int(value)
            except (TypeError, ValueError):
                continue
            outputs.append(BchTxOutput(address=str(recipient), amount_sats=amount_sats))

        return BchTransaction(
            txid=str(txid),
            timestamp=timestamp,
            confirmations=confirmations,
            outputs=outputs,
        )


def _fetch_coingecko_bch_usd_rate() -> Decimal:
    try:
        response = requests.get(COINGECKO_BCH_PRICE_URL, timeout=DEFAULT_TIMEOUT)
    except requests.RequestException as exc:
        logger.error('CoinGecko BCH/USD request failed: %s', exc, exc_info=True)
        raise BchApiError(f'CoinGecko price failed: {exc}') from exc
    if response.status_code >= 400:
        logger.error('CoinGecko BCH/USD → %s: %s', response.status_code, response.text[:300])
        raise BchApiError(f'CoinGecko price → {response.status_code}')
    try:
        payload = response.json()
        price = ((payload.get('bitcoin-cash') or {}).get('usd'))
    except (ValueError, AttributeError, TypeError) as exc:
        logger.error('Invalid CoinGecko price JSON: %s', exc, exc_info=True)
        raise BchApiError('Invalid CoinGecko price JSON') from exc
    if price is None or Decimal(str(price)) <= 0:
        logger.error('CoinGecko returned empty/invalid BCH price: %r', payload)
        raise BchApiError('No se pudo obtener el precio de BCH en USD.')
    return Decimal(str(price))


class BchElectrumClient:
    """
    Fulcrum / ElectrumX SSL client for BCH mainnet and chipnet.

    ``BCH_API_BASE`` examples:
      - ssl://bch.imaginary.cash:50002
      - ssl://chipnet.bch.ninja:50002

    Opens one TCP/SSL session per batch of RPC calls (history + tx details)
    so verify does not pay a fresh connect timeout for every txid.
    """

    def __init__(self, host: str, port: int, *, use_ssl: bool = True):
        self.host = host
        self.port = port
        self.use_ssl = use_ssl
        self._req_id = 0
        self._sock: socket.socket | ssl.SSLSocket | None = None

    @classmethod
    def from_api_base(cls, api_base: str) -> 'BchElectrumClient':
        raw = (api_base or DEFAULT_CHIPNET_ELECTRUM).strip()
        if '://' not in raw:
            raw = f'ssl://{raw}'
        parsed = urlparse(raw)
        host = parsed.hostname or 'chipnet.bch.ninja'
        port = parsed.port or 50002
        use_ssl = parsed.scheme in ('ssl', 'electrums', '')
        return cls(host, port, use_ssl=use_ssl)

    def _open(self) -> socket.socket | ssl.SSLSocket:
        try:
            sock = socket.create_connection(
                (self.host, self.port),
                timeout=ELECTRUM_CONNECT_TIMEOUT,
            )
            sock.settimeout(DEFAULT_TIMEOUT)
            if self.use_ssl:
                ctx = ssl.create_default_context()
                return ctx.wrap_socket(sock, server_hostname=self.host)
            return sock
        except (OSError, ssl.SSLError) as exc:
            logger.error(
                'Electrum %s:%s connect failed: %s',
                self.host,
                self.port,
                exc,
                exc_info=True,
            )
            raise BchApiError(
                f'Electrum {self.host}:{self.port} connect failed: {exc}'
            ) from exc

    def _close(self) -> None:
        sock = self._sock
        self._sock = None
        if sock is None:
            return
        try:
            sock.close()
        except OSError:
            pass

    def __enter__(self) -> 'BchElectrumClient':
        self._close()
        self._sock = self._open()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self._close()

    def _call(self, method: str, params: list | None = None) -> Any:
        """JSON-RPC over the open session, or a one-shot connection."""
        if self._sock is not None:
            return self._rpc(self._sock, method, params)
        with self:
            assert self._sock is not None
            return self._rpc(self._sock, method, params)

    def _rpc(self, sock: socket.socket | ssl.SSLSocket, method: str, params: list | None = None) -> Any:
        self._req_id += 1
        payload = {
            'id': self._req_id,
            'method': method,
            'params': params or [],
        }
        line = json.dumps(payload, separators=(',', ':')) + '\n'
        try:
            sock.sendall(line.encode('utf-8'))
            chunks: list[bytes] = []
            while True:
                chunk = sock.recv(65536)
                if not chunk:
                    break
                chunks.append(chunk)
                if b'\n' in chunk:
                    break
            raw = b''.join(chunks).split(b'\n', 1)[0]
        except (OSError, ssl.SSLError) as exc:
            self._close()
            logger.error(
                'Electrum %s:%s %s failed: %s',
                self.host,
                self.port,
                method,
                exc,
                exc_info=True,
            )
            raise BchApiError(
                f'Electrum {self.host}:{self.port} {method} failed: {exc}'
            ) from exc

        try:
            data = json.loads(raw.decode('utf-8'))
        except (UnicodeDecodeError, ValueError) as exc:
            logger.error(
                'Invalid Electrum JSON from %s:%s: %s',
                self.host,
                self.port,
                exc,
                exc_info=True,
            )
            raise BchApiError('Invalid Electrum JSON response') from exc
        if data.get('error'):
            logger.error('Electrum error from %s:%s: %s', self.host, self.port, data['error'])
            raise BchApiError(f'Electrum error: {data["error"]}')
        return data.get('result')

    def get_bch_usd_rate(self) -> Decimal:
        """
        Chipnet has no market price. Use ``BCH_USD_PRICE``, then Blockchair,
        then CoinGecko so order sizing still works when Blockchair is banned.
        """
        configured = Decimal(str(getattr(settings, 'BCH_USD_PRICE', 0) or 0))
        if configured > 0:
            return configured
        try:
            return BchPublicClient(api_base=BLOCKCHAIR_MAINNET).get_bch_usd_rate()
        except BchApiError as exc:
            logger.warning('USD rate via Blockchair failed (%s); CoinGecko fallback', exc)
            return _fetch_coingecko_bch_usd_rate()

    def fetch_address_history(
        self,
        address: str,
        *,
        limit: int = 25,
    ) -> tuple[list[dict], int]:
        """Return ``({tx_hash, height}, …)`` newest-first and tip height."""
        addr = (address or '').strip()
        if not addr:
            raise BchApiError('Address BCH vacía.')
        try:
            scripthash = address_to_scripthash(addr)
        except CashAddrError as exc:
            raise BchApiError(f'Dirección BCH inválida: {exc}') from exc

        def _load() -> tuple[list[dict], int]:
            try:
                history = self._call('blockchain.scripthash.get_history', [scripthash]) or []
            except BchApiError:
                raise
            except Exception as exc:
                logger.error(
                    'Unexpected Electrum history error for %s: %s',
                    addr,
                    exc,
                    exc_info=True,
                )
                raise BchApiError(f'No se pudo leer historial Electrum: {exc}') from exc

            history = list(reversed(history))[:limit]
            tip_height = 0
            try:
                header = self._call('blockchain.headers.subscribe')
                if isinstance(header, dict):
                    tip_height = int(header.get('height') or 0)
            except BchApiError:
                tip_height = 0
            return history, tip_height

        if self._sock is not None:
            return _load()
        with self:
            return _load()

    def list_recent_transactions(
        self,
        address: str,
        *,
        limit: int = 25,
    ) -> list[BchTransaction]:
        results: list[BchTransaction] = []
        failures: list[str] = []
        with self:
            history, tip_height = self.fetch_address_history(address, limit=limit)
            for item in history:
                txid = str(item.get('tx_hash') or '')
                height = int(item.get('height') or 0)
                if not txid:
                    continue
                try:
                    results.append(
                        self.get_transaction(
                            txid,
                            tip_height=tip_height,
                            tx_height=height,
                            _reuse_session=True,
                        )
                    )
                except BchApiError as exc:
                    failures.append(txid)
                    logger.warning(
                        'Skip BCH electrum tx %s on %s:%s: %s',
                        txid,
                        self.host,
                        self.port,
                        exc,
                    )

        if history and not results:
            raise BchApiError(
                f'Electrum {self.host}:{self.port} returned {len(history)} history '
                f'entries but failed to load any transaction details '
                f'(failures={len(failures)}).'
            )
        return results

    def get_transaction(
        self,
        txid: str,
        *,
        tip_height: int | None = None,
        tx_height: int | None = None,
        _reuse_session: bool = False,
    ) -> BchTransaction:
        if _reuse_session and self._sock is not None:
            raw = self._call('blockchain.transaction.get', [txid, True])
        else:
            with self:
                raw = self._call('blockchain.transaction.get', [txid, True])
        return self._parse_verbose_tx(
            txid,
            raw,
            tip_height=tip_height,
            tx_height=tx_height,
        )

    def _parse_verbose_tx(
        self,
        txid: str,
        raw: Any,
        *,
        tip_height: int | None = None,
        tx_height: int | None = None,
    ) -> BchTransaction:
        if isinstance(raw, str):
            raise BchApiError('Electrum returned non-verbose transaction')
        if not isinstance(raw, dict):
            raise BchApiError('Unexpected Electrum transaction payload')

        # Prefer explicit height from history; confirmations from tip.
        confirmations = 0
        if tx_height is not None and tx_height > 0 and tip_height:
            confirmations = max(0, int(tip_height) - int(tx_height) + 1)
        elif tx_height is not None and tx_height > 0:
            confirmations = 1
        elif tip_height and raw.get('blockheight'):
            confirmations = max(0, int(tip_height) - int(raw['blockheight']) + 1)
        else:
            try:
                confirmations = int(raw.get('confirmations') or 0)
            except (TypeError, ValueError):
                confirmations = 0

        timestamp = raw.get('time') or raw.get('blocktime')
        if timestamp is not None:
            try:
                timestamp = int(timestamp)
            except (TypeError, ValueError):
                timestamp = None
        if timestamp is None and confirmations == 0:
            timestamp = int(time.time())

        outputs: list[BchTxOutput] = []
        for out in raw.get('vout') or []:
            value = out.get('value')
            # Electrum verbose often uses BCH float for value
            try:
                if out.get('valueSat') is not None:
                    amount_sats = int(out['valueSat'])
                elif isinstance(value, str) and '.' in value:
                    amount_sats = int(
                        (Decimal(value) * SATS_PER_BCH).to_integral_value(rounding=ROUND_HALF_UP)
                    )
                elif isinstance(value, float):
                    amount_sats = int(
                        (Decimal(str(value)) * SATS_PER_BCH).to_integral_value(
                            rounding=ROUND_HALF_UP
                        )
                    )
                else:
                    amount_sats = int(
                        (Decimal(str(value)) * SATS_PER_BCH).to_integral_value(
                            rounding=ROUND_HALF_UP
                        )
                    )
            except (TypeError, ValueError, ArithmeticError):
                continue

            spk = out.get('scriptPubKey') or {}
            addresses = spk.get('addresses') or []
            if not addresses and spk.get('address'):
                addresses = [spk['address']]
            if not addresses:
                continue
            for recipient in addresses:
                outputs.append(
                    BchTxOutput(address=str(recipient), amount_sats=amount_sats)
                )

        return BchTransaction(
            txid=str(txid),
            timestamp=timestamp,
            confirmations=confirmations,
            outputs=outputs,
        )


class BchFailoverClient:
    """
    Try Fulcrum servers in order, then Blockchair HTTP for missing tx details.

    Prod logs showed ``bch.imaginary.cash`` connect timeouts on
    ``blockchain.transaction.get`` while history still listed the buyer tx —
    verify then returned an empty amounts_seen list and a false "no match".
    """

    def __init__(
        self,
        servers: list[str],
        *,
        http_fallback: BchPublicClient | None = None,
    ):
        if not servers:
            raise ValueError('BchFailoverClient requires at least one Electrum server')
        self.servers = [BchElectrumClient.from_api_base(s) for s in servers]
        self.http_fallback = http_fallback
        # Expose primary host/port for older tests / probe output.
        self.host = self.servers[0].host
        self.port = self.servers[0].port

    def get_bch_usd_rate(self) -> Decimal:
        last_err: Exception | None = None
        for client in self.servers:
            try:
                return client.get_bch_usd_rate()
            except BchApiError as exc:
                last_err = exc
                logger.warning('USD rate via Electrum %s:%s failed: %s', client.host, client.port, exc)
        if self.http_fallback is not None:
            try:
                return self.http_fallback.get_bch_usd_rate()
            except BchApiError as exc:
                last_err = exc
        try:
            return _fetch_coingecko_bch_usd_rate()
        except BchApiError as exc:
            last_err = exc
        raise BchApiError(f'No se pudo obtener el precio de BCH en USD: {last_err}')

    def list_recent_transactions(
        self,
        address: str,
        *,
        limit: int = 25,
    ) -> list[BchTransaction]:
        last_err: Exception | None = None
        history: list[dict] | None = None
        tip_height = 0
        history_client: BchElectrumClient | None = None
        results: list[BchTransaction] = []
        missing: list[tuple[str, int]] = []

        for client in self.servers:
            try:
                # One TCP/SSL session for history + as many tx details as possible.
                with client:
                    history, tip_height = client.fetch_address_history(address, limit=limit)
                    history_client = client
                    logger.info(
                        'BCH history ids via Electrum %s:%s → %s entries',
                        client.host,
                        client.port,
                        len(history),
                    )
                    if not history:
                        return []
                    for item in history:
                        txid = str(item.get('tx_hash') or '')
                        height = int(item.get('height') or 0)
                        if not txid:
                            continue
                        try:
                            results.append(
                                client.get_transaction(
                                    txid,
                                    tip_height=tip_height,
                                    tx_height=height,
                                    _reuse_session=True,
                                )
                            )
                        except BchApiError as exc:
                            missing.append((txid, height))
                            logger.warning(
                                'Primary Electrum %s:%s missed tx %s: %s',
                                client.host,
                                client.port,
                                txid,
                                exc,
                            )
                break
            except BchApiError as exc:
                last_err = exc
                history = None
                results = []
                missing = []
                history_client = None
                logger.warning(
                    'Electrum history/details failed on %s:%s: %s',
                    client.host,
                    client.port,
                    exc,
                )

        if history is None:
            if self.http_fallback is not None:
                try:
                    txs = self.http_fallback.list_recent_transactions(address, limit=limit)
                    logger.info(
                        'BCH history via Blockchair HTTP fallback → %s txs',
                        len(txs),
                    )
                    return txs
                except BchApiError as exc:
                    last_err = exc
                    logger.warning('Blockchair history fallback failed: %s', exc)
            raise BchApiError(
                f'No se pudo consultar la blockchain de BCH '
                f'(último error: {last_err})'
            )

        for txid, height in missing:
            if not txid or history_client is None:
                continue
            try:
                results.append(
                    self.get_transaction(
                        txid,
                        tip_height=tip_height,
                        tx_height=height,
                        skip_hosts={history_client.host},
                    )
                )
            except BchApiError as exc:
                logger.warning('Could not load BCH tx %s after failover: %s', txid, exc)

        if not results:
            raise BchApiError(
                f'Se listaron {len(history)} transacciones BCH pero no se pudo '
                f'cargar el detalle de ninguna. Último error: {last_err}'
            )
        return results

    def get_transaction(
        self,
        txid: str,
        *,
        tip_height: int | None = None,
        tx_height: int | None = None,
        skip_hosts: set[str] | None = None,
    ) -> BchTransaction:
        errors: list[str] = []
        skip = skip_hosts or set()
        for client in self.servers:
            if client.host in skip:
                continue
            try:
                return client.get_transaction(
                    txid, tip_height=tip_height, tx_height=tx_height,
                )
            except BchApiError as exc:
                errors.append(f'{client.host}:{client.port}={exc}')
                logger.warning(
                    'Electrum get_transaction %s failed on %s:%s: %s',
                    txid,
                    client.host,
                    client.port,
                    exc,
                )
        if self.http_fallback is not None:
            try:
                tx = self.http_fallback.get_transaction(txid, tip_height=tip_height)
                logger.info('BCH tx %s loaded via Blockchair HTTP fallback', txid)
                return tx
            except BchApiError as exc:
                errors.append(f'blockchair={exc}')
        raise BchApiError(
            f'No se pudo cargar la transacción {txid} '
            f'({" | ".join(errors[:4])})'
        )
