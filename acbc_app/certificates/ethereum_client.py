"""Sepolia client for ACBCSophiaCredentialRegistry.

The private key stays in the server environment or contracts/.env. This module
never returns it.
"""

from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
from pathlib import Path

logger = logging.getLogger(__name__)

# One signer is shared by every request in this process. The public Sepolia
# RPC can report a transaction count from before the receipt we just waited
# for, so the next transaction must not reuse that nonce.
_nonce_lock = threading.Lock()
_nonce_floors: dict[str, int] = {}

DEFAULT_REGISTRY_ADDRESS = "0xf13a2ece9747Dd286fE3e1d5C6179A875c843944"
DEFAULT_REWARD_ADDRESS = "0xf3e5c1D577479F26B78cebA09C5fABbd06517C93"
DEFAULT_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com"
DEFAULT_CHAIN_ID = 11155111

REGISTRY_ABI = [
    {
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "role", "type": "bytes32"},
            {"name": "account", "type": "address"},
        ],
        "name": "hasRole",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "REGISTRAR_ROLE",
        "outputs": [{"name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "DEFAULT_ADMIN_ROLE",
        "outputs": [{"name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"name": "knowledgePathId", "type": "string"}],
        "name": "issuerRole",
        "outputs": [{"name": "", "type": "bytes32"}],
        "stateMutability": "pure",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "role", "type": "bytes32"},
            {"name": "account", "type": "address"},
        ],
        "name": "grantRole",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "knowledgePathId", "type": "string"},
            {"name": "version", "type": "uint64"},
        ],
        "name": "achievementExists",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"name": "issuanceId", "type": "bytes32"}],
        "name": "tokenIdByIssuanceId",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "ownerOf",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "getCredential",
        "outputs": [
            {"name": "issuanceId", "type": "bytes32"},
            {"name": "achievementKey_", "type": "bytes32"},
            {"name": "credentialDigest", "type": "bytes32"},
            {"name": "credentialUri", "type": "string"},
            {"name": "issuer", "type": "address"},
            {"name": "issuedAt", "type": "uint64"},
            {"name": "status", "type": "uint8"},
            {"name": "replacedByTokenId", "type": "uint256"},
            {"name": "replacesTokenId", "type": "uint256"},
            {"name": "revokedBy", "type": "address"},
            {"name": "revokedAt", "type": "uint64"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "knowledgePathId", "type": "string"},
            {"name": "version", "type": "uint64"},
            {"name": "snapshotDigest", "type": "bytes32"},
            {"name": "uri", "type": "string"},
        ],
        "name": "registerAchievementVersion",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "recipient", "type": "address"},
            {"name": "issuanceId", "type": "bytes32"},
            {"name": "knowledgePathId", "type": "string"},
            {"name": "version", "type": "uint64"},
            {"name": "expectedSnapshotDigest", "type": "bytes32"},
            {"name": "credentialDigest", "type": "bytes32"},
            {"name": "credentialUri", "type": "string"},
        ],
        "name": "mint",
        "outputs": [{"name": "tokenId", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]

STATUS_NAMES = {
    1: "valid",
    2: "revoked",
    3: "replaced",
}

REWARD_ABI = [
    {
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "role", "type": "bytes32"},
            {"name": "account", "type": "address"},
        ],
        "name": "hasRole",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "MINTER_ROLE",
        "outputs": [{"name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "DEFAULT_ADMIN_ROLE",
        "outputs": [{"name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "role", "type": "bytes32"},
            {"name": "account", "type": "address"},
        ],
        "name": "grantRole",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"name": "issuanceId", "type": "bytes32"}],
        "name": "tokenIdByIssuanceId",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "ownerOf",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "recipient", "type": "address"},
            {"name": "issuanceId", "type": "bytes32"},
            {"name": "uri", "type": "string"},
        ],
        "name": "mint",
        "outputs": [{"name": "tokenId", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


class EthereumRegistryError(Exception):
    """A registry read or transaction could not be completed."""


def contracts_env_path() -> Path:
    return Path(__file__).resolve().parents[2] / "contracts" / ".env"


def deployed_reward_address() -> str:
    path = Path(__file__).resolve().parents[2] / "contracts" / "deployments" / "sepolia-completion-reward.json"
    if not path.is_file():
        return DEFAULT_REWARD_ADDRESS
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return DEFAULT_REWARD_ADDRESS
    return payload.get("address") or DEFAULT_REWARD_ADDRESS


def _parse_env_file(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match_line = line.strip()
        if not match_line or match_line.startswith("#") or "=" not in match_line:
            continue
        key, raw = match_line.split("=", 1)
        values[key.strip()] = raw.strip().strip('"').strip("'")
    return values


def registry_config() -> dict:
    file_values = _parse_env_file(contracts_env_path())

    def pick(*keys, default=""):
        for key in keys:
            if os.environ.get(key):
                return os.environ[key]
            if file_values.get(key):
                return file_values[key]
        return default

    chain_raw = pick("ETHEREUM_REGISTRY_CHAIN_ID", default=str(DEFAULT_CHAIN_ID))
    try:
        chain_id = int(chain_raw)
    except ValueError as exc:
        raise EthereumRegistryError("ETHEREUM_REGISTRY_CHAIN_ID no es un número.") from exc
    return {
        "rpc_url": pick("ETHEREUM_REGISTRY_RPC_URL", "SEPOLIA_RPC_URL", default=DEFAULT_RPC_URL),
        "address": pick("ETHEREUM_REGISTRY_ADDRESS", default=DEFAULT_REGISTRY_ADDRESS),
        "reward_address": pick("ETHEREUM_REWARD_ADDRESS", default=deployed_reward_address()),
        "chain_id": chain_id,
        "private_key": pick("ETHEREUM_REGISTRY_PRIVATE_KEY", "SEPOLIA_PRIVATE_KEY", default=""),
    }


def _hex_bytes(value) -> str:
    if isinstance(value, str):
        return value if value.startswith("0x") else f"0x{value}"
    text = value.hex()
    return text if text.startswith("0x") else f"0x{text}"


def _digest_bytes(hex_digest: str) -> bytes:
    raw = (hex_digest or "").lower().removeprefix("0x")
    if len(raw) != 64:
        raise EthereumRegistryError("El digest debe ser un SHA-256 de 64 caracteres hex.")
    try:
        return bytes.fromhex(raw)
    except ValueError as exc:
        raise EthereumRegistryError("El digest no es hexadecimal.") from exc


class EthereumRegistryClient:
    def __init__(self, rpc_url, address, chain_id, private_key="", reward_address=""):
        self.rpc_url = rpc_url
        self.chain_id = chain_id
        self.private_key = private_key or ""
        self.reward_address = reward_address or ""
        self._w3 = None
        self._contract = None
        self._reward = None
        self._account = None
        self.address = address

    @classmethod
    def from_env(cls):
        config = registry_config()
        return cls(
            rpc_url=config["rpc_url"],
            address=config["address"],
            chain_id=config["chain_id"],
            private_key=config["private_key"],
            reward_address=config["reward_address"],
        )

    def _ensure(self):
        if self._contract is not None:
            return
        try:
            from web3 import Web3
        except ImportError as exc:
            raise EthereumRegistryError(
                "El backend no tiene el paquete web3 instalado."
            ) from exc
        w3 = Web3(Web3.HTTPProvider(self.rpc_url, request_kwargs={"timeout": 30}))
        if not w3.is_connected():
            raise EthereumRegistryError("No se pudo conectar al RPC de Sepolia.")
        try:
            self.address = Web3.to_checksum_address(self.address)
        except Exception as exc:
            raise EthereumRegistryError("La dirección del contrato no es válida.") from exc
        self._w3 = w3
        self._contract = w3.eth.contract(address=self.address, abi=REGISTRY_ABI)
        if self.private_key:
            self._account = w3.eth.account.from_key(self.private_key)

    def checksum(self, value: str) -> str:
        self._ensure()
        from web3 import Web3
        if not isinstance(value, str) or not Web3.is_address(value):
            raise EthereumRegistryError("La dirección del destinatario no es válida.")
        return Web3.to_checksum_address(value)

    def status(self) -> dict:
        self._ensure()
        contract = self._contract
        payload = {
            "name": contract.functions.name().call(),
            "symbol": contract.functions.symbol().call(),
            "address": self.address,
            "chainId": self.chain_id,
            "signer": None,
            "signerIsAdmin": False,
            "signerIsRegistrar": False,
        }
        if self._account is not None:
            signer = self._account.address
            admin_role = contract.functions.DEFAULT_ADMIN_ROLE().call()
            registrar_role = contract.functions.REGISTRAR_ROLE().call()
            payload["signer"] = signer
            payload["signerIsAdmin"] = contract.functions.hasRole(admin_role, signer).call()
            payload["signerIsRegistrar"] = contract.functions.hasRole(registrar_role, signer).call()
        return payload

    def achievement(self, knowledge_path_id: str, version: int) -> dict:
        self._ensure()
        registered = self._contract.functions.achievementExists(
            knowledge_path_id,
            int(version),
        ).call()
        return {"registered": bool(registered)}

    def credential(self, issuance_label: str) -> dict:
        self._ensure()
        from web3 import Web3
        issuance_id = Web3.keccak(text=issuance_label)
        token_id = self._contract.functions.tokenIdByIssuanceId(issuance_id).call()
        if not token_id:
            return {"tokenId": None, "owner": None, "status": None}
        owner = self._contract.functions.ownerOf(token_id).call()
        record = self._contract.functions.getCredential(token_id).call()
        status_code = int(record[6])
        return {
            "tokenId": int(token_id),
            "owner": owner,
            "status": STATUS_NAMES.get(status_code, "unknown"),
        }

    def reward_status(self) -> dict:
        if not self.reward_address:
            return {
                "reachable": False,
                "error": "El contrato del NFT todavía no está desplegado.",
                "name": None,
                "symbol": None,
                "address": None,
                "signerIsMinter": False,
            }
        self._ensure_reward()
        contract = self._reward
        payload = {
            "reachable": True,
            "error": None,
            "name": contract.functions.name().call(),
            "symbol": contract.functions.symbol().call(),
            "address": self.reward_address,
            "signerIsMinter": False,
        }
        if self._account is not None:
            role = contract.functions.MINTER_ROLE().call()
            payload["signerIsMinter"] = contract.functions.hasRole(role, self._account.address).call()
        return payload

    def reward_token(self, issuance_label: str) -> dict:
        self._ensure_reward()
        from web3 import Web3
        issuance_id = Web3.keccak(text=issuance_label)
        token_id = self._reward.functions.tokenIdByIssuanceId(issuance_id).call()
        if not token_id:
            return {"tokenId": None, "owner": None}
        owner = self._reward.functions.ownerOf(token_id).call()
        return {"tokenId": int(token_id), "owner": owner}

    def mint_reward(self, recipient, issuance_label, uri) -> dict:
        self._ensure_reward()
        from web3 import Web3
        role_tx = self._ensure_minter()
        issuance_id = Web3.keccak(text=issuance_label)
        tx_hash = self._send(
            self._reward.functions.mint(recipient, issuance_id, uri),
            attempts=4 if role_tx else 1,
        )
        recorded = self.reward_token(issuance_label)
        if not recorded["tokenId"]:
            raise EthereumRegistryError(
                "La transacción se confirmó, pero el contrato no muestra el NFT."
            )
        return {
            "transactionHash": tx_hash,
            "tokenId": recorded["tokenId"],
            "roleTransaction": role_tx,
        }

    def register_achievement(self, knowledge_path_id, version, snapshot_digest, uri) -> dict:
        self._ensure()
        role_tx = self._ensure_registrar()
        tx_hash = self._send(
            self._contract.functions.registerAchievementVersion(
                knowledge_path_id,
                int(version),
                _digest_bytes(snapshot_digest),
                uri,
            ),
            attempts=4 if role_tx else 1,
        )
        return {"transactionHash": tx_hash, "roleTransaction": role_tx}

    def mint(
        self,
        recipient,
        issuance_label,
        knowledge_path_id,
        version,
        snapshot_digest,
        credential_digest,
        credential_uri,
    ) -> dict:
        self._ensure()
        from web3 import Web3
        role_tx = self._ensure_issuer(knowledge_path_id)
        issuance_id = Web3.keccak(text=issuance_label)
        tx_hash = self._send(
            self._contract.functions.mint(
                recipient,
                issuance_id,
                knowledge_path_id,
                int(version),
                _digest_bytes(snapshot_digest),
                _digest_bytes(credential_digest),
                credential_uri,
            ),
            attempts=4 if role_tx else 1,
        )
        recorded = self.credential(issuance_label)
        if not recorded["tokenId"]:
            raise EthereumRegistryError(
                "La transacción se confirmó, pero el contrato no muestra el certificado."
            )
        return {
            "transactionHash": tx_hash,
            "tokenId": recorded["tokenId"],
            "roleTransaction": role_tx,
        }

    def _ensure_registrar(self):
        self._ensure()
        if self._account is None:
            raise EthereumRegistryError(
                "No hay clave del firmante. Configura SEPOLIA_PRIVATE_KEY en contracts/.env."
            )
        contract = self._contract
        signer = self._account.address
        registrar_role = contract.functions.REGISTRAR_ROLE().call()
        if contract.functions.hasRole(registrar_role, signer).call():
            return None
        return self._grant(registrar_role, signer)

    def _ensure_reward(self):
        self._ensure()
        if self._reward is not None:
            return
        if not self.reward_address:
            raise EthereumRegistryError("El contrato del NFT todavía no está desplegado.")
        from web3 import Web3
        try:
            self.reward_address = Web3.to_checksum_address(self.reward_address)
        except Exception as exc:
            raise EthereumRegistryError("La dirección del NFT no es válida.") from exc
        self._reward = self._w3.eth.contract(address=self.reward_address, abi=REWARD_ABI)

    def _ensure_minter(self):
        self._ensure_reward()
        if self._account is None:
            raise EthereumRegistryError(
                "No hay clave del firmante. Configura SEPOLIA_PRIVATE_KEY en contracts/.env."
            )
        contract = self._reward
        signer = self._account.address
        role = contract.functions.MINTER_ROLE().call()
        if contract.functions.hasRole(role, signer).call():
            return None
        admin_role = contract.functions.DEFAULT_ADMIN_ROLE().call()
        if not contract.functions.hasRole(admin_role, signer).call():
            raise EthereumRegistryError(
                "El firmante no puede emitir el NFT y tampoco es admin de ese contrato."
            )
        return self._send(contract.functions.grantRole(role, signer))

    def _ensure_issuer(self, knowledge_path_id: str):
        self._ensure()
        if self._account is None:
            raise EthereumRegistryError(
                "No hay clave del firmante. Configura SEPOLIA_PRIVATE_KEY en contracts/.env."
            )
        contract = self._contract
        signer = self._account.address
        role = contract.functions.issuerRole(knowledge_path_id).call()
        if contract.functions.hasRole(role, signer).call():
            return None
        return self._grant(role, signer)

    def _grant(self, role, account) -> str:
        contract = self._contract
        admin_role = contract.functions.DEFAULT_ADMIN_ROLE().call()
        if not contract.functions.hasRole(admin_role, self._account.address).call():
            raise EthereumRegistryError(
                "El firmante no tiene ese rol y tampoco es admin del contrato."
            )
        return self._send(contract.functions.grantRole(role, account))

    def _send(self, fn, attempts: int = 1) -> str:
        if self._account is None:
            raise EthereumRegistryError(
                "No hay clave del firmante. Configura SEPOLIA_PRIVATE_KEY en contracts/.env."
            )
        last_error = None
        for attempt in range(max(attempts, 1)):
            try:
                return self._broadcast(fn)
            except EthereumRegistryError as exc:
                last_error = exc
                if attempt + 1 >= attempts or "no tiene el rol" not in str(exc):
                    raise
                logger.warning(
                    "Sepolia aún no refleja el rol para %s; reintento %s",
                    getattr(fn, "fn_name", "la operación"),
                    attempt + 2,
                )
                time.sleep(2)
        raise last_error

    def _broadcast(self, fn) -> str:
        w3 = self._w3
        last_error = None
        for attempt in range(4):
            nonce = self._peek_nonce()
            try:
                tx = fn.build_transaction({
                    "from": self._account.address,
                    "nonce": nonce,
                    "chainId": self.chain_id,
                })
                signed = self._account.sign_transaction(tx)
                raw = getattr(signed, "raw_transaction", None)
                if raw is None:
                    raw = signed.rawTransaction
                tx_hash = w3.eth.send_raw_transaction(raw)
            except EthereumRegistryError:
                raise
            except Exception as exc:
                raw = str(exc)
                message = _revert_message(exc)
                reported = _reported_next_nonce(raw)
                if reported is not None and attempt < 3:
                    self._note_nonce_used(reported - 1)
                    logger.warning(
                        "Sepolia ya usó el nonce %s; el siguiente es %s",
                        nonce,
                        reported,
                    )
                    time.sleep(2)
                    last_error = EthereumRegistryError(message)
                    continue
                if _nonce_is_stale(raw) and attempt < 3:
                    self._forget_nonce()
                    logger.warning(
                        "Sepolia ya usó el nonce %s; reintento %s",
                        nonce,
                        attempt + 2,
                    )
                    time.sleep(2)
                    last_error = EthereumRegistryError(message)
                    continue
                logger.warning(
                    "Sepolia rechazó %s: %s",
                    getattr(fn, "fn_name", "la operación"),
                    message,
                )
                raise EthereumRegistryError(message) from exc
            self._note_nonce_used(nonce)
            try:
                receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
            except Exception as exc:
                message = _revert_message(exc)
                logger.warning(
                    "Sepolia rechazó %s: %s",
                    getattr(fn, "fn_name", "la operación"),
                    message,
                )
                raise EthereumRegistryError(message) from exc
            if getattr(receipt, "status", 1) != 1:
                message = f"La transacción falló: {_hex_bytes(tx_hash)}"
                logger.warning(
                    "Sepolia rechazó %s: %s",
                    getattr(fn, "fn_name", "la operación"),
                    message,
                )
                raise EthereumRegistryError(message)
            return _hex_bytes(tx_hash)
        raise last_error

    def _peek_nonce(self) -> int:
        chain = self._w3.eth.get_transaction_count(self._account.address, "pending")
        with _nonce_lock:
            floor = _nonce_floors.get(self._account.address.lower())
        if floor is None:
            return chain
        return max(chain, floor)

    def _note_nonce_used(self, nonce: int) -> None:
        with _nonce_lock:
            key = self._account.address.lower()
            _nonce_floors[key] = max(_nonce_floors.get(key, 0), nonce + 1)

    def _forget_nonce(self) -> None:
        with _nonce_lock:
            _nonce_floors.pop(self._account.address.lower(), None)


_HEX_BLOB = re.compile(r"0x[0-9a-fA-F]{8,}")

_ROLE_NAMES = {
    "0" * 64: "DEFAULT_ADMIN_ROLE",
    "edcc084d3dcd65a1f7f23c65c46722faca6953d28e43150a467cf43e5c309238": "REGISTRAR_ROLE",
    "65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a": "PAUSER_ROLE",
    "3dca6a674b81623858ebce57c7c20a50818c6ef662d2d4d75230636c3a4f75cb": "EVIDENCE_ROLE",
    "9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6": "MINTER_ROLE",
}

_REVERT_TEXT = {
    "d92e233d": "El contrato rechazó una dirección vacía.",
    "506f3a1b": "El hash enviado está vacío.",
    "1208b21b": "El contrato recibió un texto vacío.",
    "23214670": "Esa versión del snapshot ya está registrada.",
    "3393b804": "Esa versión del snapshot no está registrada. Regístrala antes de emitir el certificado.",
    "a2dcb16a": "El hash del snapshot no coincide con el que está registrado.",
    "7dbdd292": "Ese identificador de emisión ya se usó.",
    "a9de8c6f": "Ese certificado no se puede transferir.",
    "8734687b": "El contrato no permite aprobaciones de transferencia.",
    "d93c0665": "El contrato está pausado.",
    "3ee5aeb5": "El contrato rechazó la operación por una llamada reentrante.",
}


def _revert_message(exc: Exception) -> str:
    for payload in _HEX_BLOB.findall(str(exc)):
        decoded = _decode_revert(payload)
        if decoded:
            return decoded
    text = str(exc).strip() or exc.__class__.__name__
    if _nonce_is_stale(text):
        return (
            "La red ya usó ese número de transacción. "
            "Vuelve a pulsar el botón para enviarla con el número actual."
        )
    if len(text) > 500:
        text = text[:500]
    return f"El contrato rechazó la operación: {text}"


def _nonce_is_stale(message: str) -> bool:
    text = message.lower()
    return "nonce too low" in text or "nonce has already been used" in text


def _reported_next_nonce(message: str) -> int | None:
    match = re.search(r"next nonce (\d+)", message, re.IGNORECASE)
    if match is None:
        return None
    return int(match.group(1))


def _decode_revert(payload: str) -> str:
    raw = payload[2:] if payload.startswith(("0x", "0X")) else payload
    raw = raw.lower()
    if len(raw) < 8:
        return ""
    selector = raw[:8]
    body = raw[8:]
    if selector == "e2517d3f" and len(body) >= 128:
        account = _checksum_address("0x" + body[24:64])
        role = _ROLE_NAMES.get(body[64:128], "un rol no reconocido")
        return (
            f"La cuenta {account} no tiene el rol {role}. "
            "Sin ese rol el contrato no acepta la operación."
        )
    if selector == "2f814e2d" and len(body) >= 128:
        expected = int(body[:64], 16)
        provided = int(body[64:128], 16)
        return (
            "La versión del snapshot no es la siguiente. "
            f"El contrato espera la versión {expected} y recibió la {provided}."
        )
    if selector == "8d5faafe" and len(body) >= 64:
        account = _checksum_address("0x" + body[24:64])
        return f"La cuenta {account} ya tiene un certificado de esta versión."
    return _REVERT_TEXT.get(selector, "")


def _checksum_address(address: str) -> str:
    try:
        from web3 import Web3
        return Web3.to_checksum_address(address)
    except Exception:
        return address
