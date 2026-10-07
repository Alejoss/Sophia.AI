"""Staff actions that read and mint knowledge-path credentials on Sepolia."""

from __future__ import annotations

import hashlib
import json
from datetime import timezone as dt_timezone

from django.db import transaction
from django.utils import timezone

from certificates.ethereum_client import EthereumRegistryError
from certificates.models import Certificate
from content.utils import build_media_url
from knowledge_paths.knowledge_path_snapshot import jcs_dumps
from knowledge_paths.models import PublishedKnowledgePathSnapshot


def credential_label(certificate: Certificate) -> str:
    return f"sophia-acbc:credential:{certificate.certificate_id}"


def reward_label(certificate: Certificate) -> str:
    return f"sophia-acbc:reward:{certificate.certificate_id}"


def knowledge_path_key(path_id: int) -> str:
    return f"sophia-acbc:knowledge-path:{path_id}"


def latest_snapshot(certificate: Certificate):
    if certificate.knowledge_path_id is None:
        return None
    return (
        PublishedKnowledgePathSnapshot.objects.filter(
            knowledge_path_id=certificate.knowledge_path_id,
        )
        .order_by("-version")
        .first()
    )


def dashboard(client, request=None) -> dict:
    try:
        contract = client.status()
        contract["reachable"] = True
        contract["error"] = None
    except EthereumRegistryError as exc:
        contract = {
            "reachable": False,
            "error": str(exc),
            "name": None,
            "symbol": None,
            "address": None,
            "chainId": None,
            "signer": None,
            "signerIsAdmin": False,
            "signerIsRegistrar": False,
        }

    try:
        reward = client.reward_status()
    except EthereumRegistryError as exc:
        reward = {
            "reachable": False,
            "error": str(exc),
            "name": None,
            "symbol": None,
            "address": None,
            "signerIsMinter": False,
        }

    certificates = (
        Certificate.objects.filter(knowledge_path__isnull=False)
        .select_related("user", "knowledge_path")
        .order_by("-issued_on", "-id")
    )
    rows = []
    for certificate in certificates:
        rows.append(_certificate_row(certificate, client, contract["reachable"], reward, request))
    return {"contract": contract, "reward": reward, "certificates": rows}


def register_version(certificate: Certificate, client, snapshot_uri: str) -> dict:
    snapshot = _require_snapshot(certificate)
    path_key = knowledge_path_key(certificate.knowledge_path_id)
    chain = client.achievement(path_key, snapshot.version)
    if chain["registered"]:
        return {
            "alreadyRegistered": True,
            "version": snapshot.version,
            "knowledgePathId": path_key,
            "transactionHash": None,
            "roleTransaction": None,
        }
    result = client.register_achievement(
        path_key,
        snapshot.version,
        snapshot.digest,
        snapshot_uri,
    )
    result.update({
        "alreadyRegistered": False,
        "version": snapshot.version,
        "knowledgePathId": path_key,
    })
    return result


def mint_credential(certificate: Certificate, recipient: str, client, credential_uri: str) -> dict:
    snapshot = _require_snapshot(certificate)
    path_key = knowledge_path_key(certificate.knowledge_path_id)
    label = credential_label(certificate)
    checksummed = client.checksum(recipient)

    with transaction.atomic():
        locked = Certificate.objects.select_for_update().get(pk=certificate.pk)
        existing = client.credential(label)
        if existing["tokenId"]:
            _remember_mint(locked, checksummed, existing["tokenId"], locked.blockchain_hash)
            return {
                "alreadyMinted": True,
                "tokenId": existing["tokenId"],
                "owner": existing["owner"],
                "status": existing["status"],
                "transactionHash": locked.blockchain_hash,
                "credentialDigest": locked.credential_digest,
                "roleTransaction": None,
            }

        achievement = client.achievement(path_key, snapshot.version)
        if not achievement["registered"]:
            raise EthereumRegistryError(
                "Registra la versión del snapshot en el contrato antes de enviar el certificado."
            )

        canonical, digest = _freeze_artifact(locked, checksummed, snapshot)
        locked.credential_uri = credential_uri
        locked.ethereum_status = "minting"
        locked.ethereum_error = ""
        locked.save(update_fields=[
            "ethereum_recipient",
            "credential_canonical",
            "credential_digest",
            "credential_uri",
            "ethereum_status",
            "ethereum_error",
        ])

    try:
        result = client.mint(
            checksummed,
            label,
            path_key,
            snapshot.version,
            snapshot.digest,
            digest,
            credential_uri,
        )
    except EthereumRegistryError as exc:
        Certificate.objects.filter(pk=certificate.pk).update(
            ethereum_status="failed",
            ethereum_error=str(exc),
        )
        raise

    locked.refresh_from_db()
    _remember_mint(locked, checksummed, result["tokenId"], result["transactionHash"])
    return {
        "alreadyMinted": False,
        "tokenId": result["tokenId"],
        "transactionHash": result["transactionHash"],
        "credentialDigest": digest,
        "credentialCanonical": canonical,
        "roleTransaction": result.get("roleTransaction"),
    }


def reward_image_url(certificate: Certificate, request=None) -> str:
    uri = (certificate.reward_image_uri or "").strip()
    if uri:
        return uri
    if not certificate.reward_image:
        return ""
    return build_media_url(certificate.reward_image, request) or ""


def reward_metadata(certificate: Certificate, request=None) -> dict:
    snapshot = latest_snapshot(certificate)
    title = certificate.knowledge_path.title if certificate.knowledge_path_id else ""
    payload = {
        "name": f"ACBC Completion Reward · {title}",
        "description": (
            "Transferable reward for completing a knowledge path on "
            "Sophia.AI Academia Blockchain. This token can be sent. "
            "The non-transferable certificate is a separate token."
        ),
        "attributes": [
            {"trait_type": "knowledgePath", "value": title},
            {"trait_type": "version", "value": snapshot.version if snapshot else None},
            {"trait_type": "learner", "value": certificate.user.username},
        ],
    }
    image = reward_image_url(certificate, request)
    if image:
        payload["image"] = image
    return payload


def mint_reward(certificate: Certificate, recipient: str, client, reward_uri: str) -> dict:
    _require_snapshot(certificate)
    label = reward_label(certificate)
    checksummed = client.checksum(recipient)

    with transaction.atomic():
        locked = Certificate.objects.select_for_update().get(pk=certificate.pk)
        existing = client.reward_token(label)
        if existing["tokenId"]:
            _remember_reward(locked, checksummed, existing["tokenId"], locked.reward_tx_hash)
            return {
                "alreadyMinted": True,
                "tokenId": existing["tokenId"],
                "owner": existing["owner"],
                "transactionHash": locked.reward_tx_hash,
                "roleTransaction": None,
            }

    try:
        result = client.mint_reward(checksummed, label, reward_uri)
    except EthereumRegistryError as exc:
        Certificate.objects.filter(pk=certificate.pk).update(
            reward_status="failed",
            reward_error=str(exc),
            reward_recipient=checksummed,
        )
        raise

    locked.refresh_from_db()
    _remember_reward(locked, checksummed, result["tokenId"], result["transactionHash"])
    return {
        "alreadyMinted": False,
        "tokenId": result["tokenId"],
        "transactionHash": result["transactionHash"],
        "roleTransaction": result.get("roleTransaction"),
    }


def _certificate_row(certificate: Certificate, client, reachable: bool, reward_contract: dict, request=None) -> dict:
    snapshot = latest_snapshot(certificate)
    path_key = knowledge_path_key(certificate.knowledge_path_id)
    chain = {
        "achievementRegistered": False,
        "tokenId": None,
        "owner": None,
        "status": None,
        "error": None,
    }
    if snapshot is None:
        chain = None
    elif reachable:
        try:
            achievement = client.achievement(path_key, snapshot.version)
            recorded = client.credential(credential_label(certificate))
            chain = {
                "achievementRegistered": achievement["registered"],
                "tokenId": recorded["tokenId"],
                "owner": recorded["owner"],
                "status": recorded["status"],
                "error": None,
            }
            if recorded["tokenId"] and certificate.ethereum_token_id != recorded["tokenId"]:
                _remember_mint(
                    certificate,
                    recorded["owner"] or certificate.ethereum_recipient,
                    recorded["tokenId"],
                    certificate.blockchain_hash,
                )
        except EthereumRegistryError as exc:
            chain["error"] = str(exc)
    else:
        chain["error"] = "El contrato no está disponible."

    reward = {"tokenId": None, "owner": None, "error": None}
    if reward_contract.get("reachable"):
        try:
            recorded = client.reward_token(reward_label(certificate))
            reward = {
                "tokenId": recorded["tokenId"],
                "owner": recorded["owner"],
                "error": None,
            }
            if recorded["tokenId"] and certificate.reward_token_id != recorded["tokenId"]:
                _remember_reward(
                    certificate,
                    recorded["owner"] or certificate.reward_recipient,
                    recorded["tokenId"],
                    certificate.reward_tx_hash,
                )
        except EthereumRegistryError as exc:
            reward["error"] = str(exc)
    else:
        reward["error"] = reward_contract.get("error")

    return {
        "id": certificate.id,
        "certificateId": str(certificate.certificate_id),
        "learner": certificate.user.username,
        "knowledgePathDbId": certificate.knowledge_path_id,
        "knowledgePathTitle": certificate.knowledge_path.title,
        "knowledgePathId": path_key,
        "snapshotVersion": snapshot.version if snapshot else None,
        "snapshotDigest": snapshot.digest if snapshot else None,
        "recipient": certificate.ethereum_recipient,
        "transactionHash": certificate.blockchain_hash,
        "ethereumStatus": certificate.ethereum_status,
        "ethereumError": certificate.ethereum_error,
        "rewardRecipient": certificate.reward_recipient,
        "rewardTransactionHash": certificate.reward_tx_hash,
        "rewardStatus": certificate.reward_status,
        "rewardError": certificate.reward_error,
        "rewardImage": reward_image_url(certificate, request),
        "rewardImageFile": (
            build_media_url(certificate.reward_image, request) or ""
            if certificate.reward_image else ""
        ),
        "rewardImageUri": certificate.reward_image_uri,
        "chain": chain,
        "reward": reward,
    }


def _require_snapshot(certificate: Certificate):
    if certificate.knowledge_path_id is None:
        raise EthereumRegistryError("Solo los certificados de knowledge path se envían a este contrato.")
    snapshot = latest_snapshot(certificate)
    if snapshot is None:
        raise EthereumRegistryError(
            "Este knowledge path no tiene un snapshot. Tómalo en el panel de Snapshots antes de registrarlo."
        )
    return snapshot


def _freeze_artifact(certificate: Certificate, recipient: str, snapshot) -> tuple[str, str]:
    if (
        certificate.credential_canonical
        and certificate.ethereum_recipient == recipient
    ):
        return certificate.credential_canonical, certificate.credential_digest

    document = snapshot.document if isinstance(snapshot.document, dict) else json.loads(snapshot.document_text)
    issuer = document.get("issuer")
    if not isinstance(issuer, dict):
        raise EthereumRegistryError("El snapshot no tiene un emisor válido.")
    issued_at = timezone.now().astimezone(dt_timezone.utc).replace(microsecond=0)
    issued_at_str = issued_at.strftime("%Y-%m-%dT%H:%M:%SZ")
    artifact = {
        "schemaVersion": "sophia-acbc-credential-v1",
        "credentialId": credential_label(certificate),
        "type": "knowledge_path_completion",
        "recipient": recipient,
        "knowledgePathId": knowledge_path_key(certificate.knowledge_path_id),
        "knowledgePathVersion": snapshot.version,
        "knowledgePathSnapshotHash": snapshot.digest,
        "issuedAt": issued_at_str,
        "issuer": {
            "namespace": issuer.get("namespace"),
            "authorUserId": issuer.get("authorUserId"),
            "authorUsername": issuer.get("authorUsername"),
        },
    }
    canonical = jcs_dumps(artifact)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    certificate.ethereum_recipient = recipient
    certificate.credential_canonical = canonical
    certificate.credential_digest = digest
    return canonical, digest


def _remember_mint(certificate: Certificate, recipient: str, token_id: int, tx_hash) -> None:
    certificate.ethereum_token_id = token_id
    certificate.ethereum_status = "minted"
    certificate.ethereum_error = ""
    if recipient:
        certificate.ethereum_recipient = recipient
    if tx_hash:
        certificate.blockchain_hash = tx_hash
    certificate.save(update_fields=[
        "ethereum_token_id",
        "ethereum_status",
        "ethereum_error",
        "ethereum_recipient",
        "blockchain_hash",
    ])


def _remember_reward(certificate: Certificate, recipient: str, token_id: int, tx_hash) -> None:
    certificate.reward_token_id = token_id
    certificate.reward_status = "minted"
    certificate.reward_error = ""
    if recipient:
        certificate.reward_recipient = recipient
    if tx_hash:
        certificate.reward_tx_hash = tx_hash
    certificate.save(update_fields=[
        "reward_token_id",
        "reward_status",
        "reward_error",
        "reward_recipient",
        "reward_tx_hash",
    ])
