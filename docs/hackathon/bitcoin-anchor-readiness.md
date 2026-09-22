# Bitcoin transcript anchoring: readiness review

Reviewed: 2026-09-22. This is a code/documentation review, not proof of a live
production broadcast. No Bitcoin transaction was sent during the review.

## Verdict

Core functionality exists: normalized SHA-256 text snapshots, OP_RETURN transaction
construction/signing, paid requests, staff/CLI broadcast, fee limits, confirmation
polling and public anchor history. It is suitable for focused validation and
hardening; do not describe it as production-ready based on documentation alone.

## Findings to address

1. **Durable broadcast/retry handling** (`content/bitcoin/service.py`): external
   broadcast happens within `transaction.atomic`, before durable transaction
   persistence. Timeout or rollback after network acceptance leaves an uncertain
   outcome. Persist signed transaction identity before submission, reconcile by
   txid, and serialize wallet UTXO use across requests. The paid-request row lock
   does not coordinate every staff/CLI request or different requests sharing a wallet.
2. **Failure-state rollback** (same file): error branches save `failed` and then
   raise out of the atomic function, rolling back those saves. Test persisted
   state after exceptions and restructure transaction boundaries.
3. **Network immutability** (`views_transcript_anchor.py`,
   `anchor_request_service.py`): existing records may have `btc_network` changed
   before an already-broadcast/anchored check. Keep historical network/txid pairs
   immutable; validate supported networks and ensure the Esplora endpoint matches.
   `EsploraClient()` currently uses a global API base, not the record's network.
4. **Reorganization handling** (`content/bitcoin/service.py`): normal reads refresh
   only broadcast records; explicit refresh does not demote an anchored record
   that loses confirmation. Define revalidation and status transitions.
5. **Historical evidence**: anchor history exposes saved certified text, but
   current transcript lookup is not a stable historical reference. Preserve exact
   bytes, provide a readable/downloadable verification experience and handle
   legacy records missing text. IPFS archival remains planned.

These are implementation findings, not all reproduced failure cases. Add focused
regression tests before changing transaction or payment behavior. Review paid
fulfillment when transcript content changes after payment; it currently rejects
a hash mismatch instead of silently anchoring another version.

## Validation record

Targeted suites: `content.tests_bitcoin_anchor`,
`content.tests.TranscriptAnchorModelTests`, `content.tests.TranscriptAnchorAPITests`.
The normal local invocation initially failed because the configured log file
could not be opened. Retried with Django logging configuration disabled only
in the test process; no application logging settings were changed.
Result: **21 tests passed**; Django system checks found no issues. These tests do not validate live
payment providers, real network broadcast, production credentials or concurrent
PostgreSQL wallet behavior.

## Next meaningful demonstration

- Fix and regression-test durable retries, persisted errors and network identity.
- Demonstrate exact-text download and local hash verification, including an old
  transcript after a content edit and an intentionally modified-file failure.
- Run an explicitly configured signet end-to-end test, record txid, network,
  payload and confirmations, and distinguish payment approval from confirmation.
- Exercise a paid request in a test environment without charging real users.
- Complete IPFS preservation as part of the new archival work.

## Contribution history

The Bitcoin feature predates the hackathon, but not every improvement does:

- `961cd43`, 2026-09-10: automatic broadcast after payment.
- `fd90130`, 2026-09-10: platform-credit payment for Bitcoin anchors.
- `c5f3f8d`, 2026-09-14 15:35:46 UTC: show the exact hashed transcript text.

The last timestamp falls after the previously verified competition start
(September 14, 06:00 Pacific / 13:00 UTC). Describe it as an improvement to an
existing feature, with the commit as evidence; organizer eligibility decisions
remain separate. This review/documentation is current work, not a claim that the
above reliability fixes or IPFS functionality are already implemented.
