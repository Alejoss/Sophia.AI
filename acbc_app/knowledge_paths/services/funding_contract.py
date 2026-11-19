"""CashScript artifact and the values the campaign contract checks."""

from __future__ import annotations

import json
from datetime import timezone as dt_timezone
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from knowledge_paths.models import PathProposal
from payments.bch_cashaddr import address_locking_script

DUST_SATS = 1000
MIN_PLEDGE_SATS = 10000
STATE_OPEN = '00'
STATE_FUNDED = '01'
STATE_EXPIRED = '02'


def artifact_path() -> Path:
    base = Path(settings.BASE_DIR)
    return base.parent / 'contracts' / 'path-funding' / 'artifact.json'


@lru_cache(maxsize=1)
def load_artifact() -> dict:
    return json.loads(artifact_path().read_text(encoding='utf-8'))


def constructor_args(proposal: PathProposal) -> list:
    """Arguments that recreate this campaign's locking script."""
    deadline = proposal.deadline
    if timezone.is_naive(deadline):
        raise ValueError('Deadline must be timezone-aware.')
    deadline = deadline.astimezone(dt_timezone.utc).replace(microsecond=0)
    payout = proposal.author_payout_address
    script = address_locking_script(payout).hex() if payout else ''
    return [
        int(proposal.pk),
        int(proposal.goal_sats),
        int(deadline.timestamp()),
        script,
    ]


def decode_receipt_commitment(commitment: str) -> tuple[int, int] | None:
    """Decode bytes8(proposalId) + bytes8(amount). Both are little-endian."""
    hex_value = (commitment or '').strip().lower()
    if len(hex_value) != 32:
        return None
    try:
        raw = bytes.fromhex(hex_value)
    except ValueError:
        return None
    if raw[7] & 0x80 or raw[15] & 0x80:
        return None
    proposal_id = int.from_bytes(raw[:8], 'little')
    amount = int.from_bytes(raw[8:], 'little')
    if proposal_id <= 0 or amount <= 0:
        return None
    return proposal_id, amount
