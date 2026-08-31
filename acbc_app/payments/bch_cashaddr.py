"""Minimal CashAddr decode → P2PKH/P2SH scripthash for Electrum/Fulcrum."""
from __future__ import annotations

import hashlib

CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
_CHARSET_MAP = {c: i for i, c in enumerate(CHARSET)}

# cashaddr version byte: high bits = type, low 3 bits = size
_TYPE_P2PKH = 0
_TYPE_P2SH = 1
_HASH_SIZES = {
    0: 20,
    1: 24,
    2: 28,
    3: 32,
    4: 40,
    5: 48,
    6: 56,
    7: 64,
}


class CashAddrError(ValueError):
    """Invalid CashAddr."""


def _polymod(values: list[int]) -> int:
    generators = [0x98F2BC8E61, 0x79B76D99E2, 0xF33E5FB3C4, 0xAE2EABE2A8, 0x1E4F43E470]
    chk = 1
    for value in values:
        top = chk >> 35
        chk = ((chk & 0x07FFFFFFFF) << 5) ^ value
        for i in range(5):
            if (top >> i) & 1:
                chk ^= generators[i]
    return chk


def _prefix_expand(prefix: str) -> list[int]:
    return [ord(c) & 0x1F for c in prefix] + [0]


def _convertbits(data: list[int], from_bits: int, to_bits: int, pad: bool = True) -> list[int]:
    acc = 0
    bits = 0
    ret: list[int] = []
    maxv = (1 << to_bits) - 1
    for value in data:
        if value < 0 or value >> from_bits:
            raise CashAddrError('Invalid cashaddr payload')
        acc = (acc << from_bits) | value
        bits += from_bits
        while bits >= to_bits:
            bits -= to_bits
            ret.append((acc >> bits) & maxv)
    if pad and bits:
        ret.append((acc << (to_bits - bits)) & maxv)
    elif bits >= from_bits or ((acc << (to_bits - bits)) & maxv):
        raise CashAddrError('Invalid cashaddr padding')
    return ret


def encode_cashaddr(prefix: str, addr_type: int, hash_bytes: bytes) -> str:
    """Encode a CashAddr string (P2PKH/P2SH)."""
    size_code = None
    for code, size in _HASH_SIZES.items():
        if size == len(hash_bytes):
            size_code = code
            break
    if size_code is None:
        raise CashAddrError('Unsupported hash length')
    version_byte = (int(addr_type) << 3) | size_code
    payload5 = _convertbits([version_byte] + list(hash_bytes), 8, 5, pad=True)
    mod = _polymod(_prefix_expand(prefix) + payload5 + [0] * 8)
    checksum = [(mod >> 5 * (7 - i)) & 31 for i in range(8)]
    return prefix + ':' + ''.join(CHARSET[d] for d in payload5 + checksum)


def decode_cashaddr(address: str) -> tuple[str, int, bytes]:
    """
    Return (prefix, version_byte, hash_bytes).

    ``prefix`` is e.g. ``bitcoincash`` or ``bchtest`` (without colon).
    """
    addr = (address or '').strip()
    if not addr:
        raise CashAddrError('Empty address')
    lower = addr.lower()
    if addr != lower and addr != addr.upper():
        raise CashAddrError('Mixed-case CashAddr')
    addr = lower
    if ':' in addr:
        prefix, payload = addr.split(':', 1)
    else:
        prefix, payload = 'bitcoincash', addr
    if not prefix or not payload:
        raise CashAddrError('Malformed CashAddr')

    data = []
    for ch in payload:
        if ch not in _CHARSET_MAP:
            raise CashAddrError(f'Invalid CashAddr character: {ch}')
        data.append(_CHARSET_MAP[ch])

    if _polymod(_prefix_expand(prefix) + data) != 0:
        raise CashAddrError('Bad CashAddr checksum')

    decoded = _convertbits(data[:-8], 5, 8, pad=False)
    if not decoded:
        raise CashAddrError('Empty CashAddr payload')
    version = decoded[0]
    hash_bytes = bytes(decoded[1:])
    size_code = version & 0x07
    expected = _HASH_SIZES.get(size_code)
    if expected is None or len(hash_bytes) != expected:
        raise CashAddrError('Unexpected CashAddr hash length')
    return prefix, version, hash_bytes


def address_to_scripthash(address: str) -> str:
    """Electrum scripthash (hex) for a CashAddr P2PKH/P2SH address."""
    _prefix, version, payload = decode_cashaddr(address)
    addr_type = version >> 3
    if addr_type == _TYPE_P2PKH:
        if len(payload) != 20:
            raise CashAddrError('P2PKH payload must be 20 bytes')
        script = bytes([0x76, 0xA9, 0x14]) + payload + bytes([0x88, 0xAC])
    elif addr_type == _TYPE_P2SH:
        if len(payload) != 20:
            raise CashAddrError('P2SH payload must be 20 bytes')
        script = bytes([0xA9, 0x14]) + payload + bytes([0x87])
    else:
        raise CashAddrError(f'Unsupported CashAddr type: {addr_type}')
    digest = hashlib.sha256(script).digest()
    return digest[::-1].hex()


def address_prefix(address: str) -> str:
    prefix, _version, _payload = decode_cashaddr(address)
    return prefix
