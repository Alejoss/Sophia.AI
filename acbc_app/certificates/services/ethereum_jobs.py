"""Sepolia writes that outlive the HTTP request.

The browser client stops at 30 seconds. Granting a role and waiting for a
Sepolia receipt takes longer than that, so the request only records the job.
A background thread sends the transaction and stores the receipt.
"""

from __future__ import annotations

import logging
import sys
import threading

from django.db import close_old_connections

from certificates.ethereum_client import EthereumRegistryError
from certificates.models import Certificate
from certificates.services.ethereum_credentials import (
    _remember_mint,
    _remember_reward,
    _require_snapshot,
    credential_label,
    knowledge_path_key,
    mint_credential,
    mint_reward,
    register_version,
    reward_label,
)

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_running: set[tuple[str, int]] = set()


def jobs_run_inline() -> bool:
    """Tests call the chain double directly and expect the finished payload."""
    return "test" in sys.argv


def begin_register(certificate: Certificate, snapshot_uri: str, client_factory) -> dict:
    if not _claim("register", certificate.pk):
        return {"pending": True}
    try:
        client = client_factory()
        snapshot = _require_snapshot(certificate)
        path_key = knowledge_path_key(certificate.knowledge_path_id)
        if client.achievement(path_key, snapshot.version)["registered"]:
            _release("register", certificate.pk)
            return {
                "pending": False,
                "alreadyRegistered": True,
                "version": snapshot.version,
                "knowledgePathId": path_key,
                "transactionHash": None,
                "roleTransaction": None,
            }
        Certificate.objects.filter(pk=certificate.pk).update(
            ethereum_status="registering",
            ethereum_error="",
        )
    except Exception:
        _release("register", certificate.pk)
        raise

    certificate_id = certificate.pk

    def work():
        current = Certificate.objects.select_related("knowledge_path", "user").get(pk=certificate_id)
        register_version(current, client_factory(), snapshot_uri)
        Certificate.objects.filter(pk=certificate_id, ethereum_status="registering").update(
            ethereum_status="",
            ethereum_error="",
        )

    _start("register", certificate_id, work)
    return {"pending": True}


def begin_mint(certificate: Certificate, recipient: str, credential_uri: str, client_factory) -> dict:
    if not _claim("mint", certificate.pk):
        return {"pending": True}
    try:
        client = client_factory()
        checksummed = client.checksum(recipient)
        snapshot = _require_snapshot(certificate)
        path_key = knowledge_path_key(certificate.knowledge_path_id)
        if not client.achievement(path_key, snapshot.version)["registered"]:
            raise EthereumRegistryError(
                "Registra la versión del snapshot en el contrato antes de enviar el certificado."
            )
        existing = client.credential(credential_label(certificate))
        if existing["tokenId"]:
            _remember_mint(
                certificate,
                existing["owner"] or checksummed,
                existing["tokenId"],
                certificate.blockchain_hash,
            )
            _release("mint", certificate.pk)
            return {
                "pending": False,
                "alreadyMinted": True,
                "tokenId": existing["tokenId"],
                "owner": existing["owner"],
                "status": existing["status"],
                "transactionHash": certificate.blockchain_hash,
            }
        Certificate.objects.filter(pk=certificate.pk).update(
            ethereum_status="minting",
            ethereum_error="",
            ethereum_recipient=checksummed,
        )
    except Exception:
        _release("mint", certificate.pk)
        raise

    certificate_id = certificate.pk

    def work():
        current = Certificate.objects.select_related("knowledge_path", "user").get(pk=certificate_id)
        mint_credential(current, recipient, client_factory(), credential_uri)

    _start("mint", certificate_id, work)
    return {"pending": True}


def begin_reward(certificate: Certificate, recipient: str, reward_uri: str, client_factory) -> dict:
    if not _claim("reward", certificate.pk):
        return {"pending": True}
    try:
        client = client_factory()
        checksummed = client.checksum(recipient)
        _require_snapshot(certificate)
        existing = client.reward_token(reward_label(certificate))
        if existing["tokenId"]:
            _remember_reward(
                certificate,
                existing["owner"] or checksummed,
                existing["tokenId"],
                certificate.reward_tx_hash,
            )
            _release("reward", certificate.pk)
            return {
                "pending": False,
                "alreadyMinted": True,
                "tokenId": existing["tokenId"],
                "owner": existing["owner"],
                "transactionHash": certificate.reward_tx_hash,
            }
        Certificate.objects.filter(pk=certificate.pk).update(
            reward_status="minting",
            reward_error="",
            reward_recipient=checksummed,
        )
    except Exception:
        _release("reward", certificate.pk)
        raise

    certificate_id = certificate.pk

    def work():
        current = Certificate.objects.select_related("knowledge_path", "user").get(pk=certificate_id)
        mint_reward(current, recipient, client_factory(), reward_uri)

    _start("reward", certificate_id, work)
    return {"pending": True}


def _claim(kind: str, certificate_id: int) -> bool:
    key = (kind, certificate_id)
    with _lock:
        if key in _running:
            return False
        _running.add(key)
        return True


def _release(kind: str, certificate_id: int) -> None:
    with _lock:
        _running.discard((kind, certificate_id))


def _start(kind: str, certificate_id: int, work) -> None:
    def runner():
        close_old_connections()
        try:
            work()
        except EthereumRegistryError as exc:
            logger.warning("Sepolia job %s for certificate %s: %s", kind, certificate_id, exc)
            _mark_failed(kind, certificate_id, str(exc))
        except Exception as exc:
            logger.exception("Sepolia job %s failed for certificate %s", kind, certificate_id)
            _mark_failed(kind, certificate_id, str(exc))
        finally:
            _release(kind, certificate_id)
            close_old_connections()

    threading.Thread(
        target=runner,
        name=f"sepolia-{kind}-{certificate_id}",
        daemon=True,
    ).start()


def _mark_failed(kind: str, certificate_id: int, message: str) -> None:
    text = message[:1000]
    if kind == "reward":
        Certificate.objects.filter(pk=certificate_id, reward_status="minting").update(
            reward_status="failed",
            reward_error=text,
        )
        return
    pending = "registering" if kind == "register" else "minting"
    Certificate.objects.filter(pk=certificate_id, ethereum_status=pending).update(
        ethereum_status="failed",
        ethereum_error=text,
    )
