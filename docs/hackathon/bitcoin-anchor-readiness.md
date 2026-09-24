# Bitcoin transcript anchoring: readiness review

Reviewed: 2026-09-22. Reliability hardening implemented: 2026-09-23.
The original review was a code/documentation assessment, not proof of a live
production broadcast. No Bitcoin mainnet transaction was sent during that review.

## Verdict

Core functionality exists: normalized SHA-256 text snapshots, OP_RETURN transaction
construction/signing, paid requests, staff/CLI broadcast, fee limits, confirmation
polling and public anchor history. **2026-09-23 hardening** addresses durable
broadcast/retry, persisted failure state, network/Esplora identity, reorg demotion,
and exact certified-text download for independent verification.

Still do not describe the feature as production-ready for mainnet without a
recorded signet (or mainnet) end-to-end payment → broadcast → confirmation run
and concurrent wallet load testing under PostgreSQL.

## Findings addressed (2026-09-23)

1. **Durable broadcast/retry** (`content/bitcoin/service.py`): signed raw
   transaction + predicted txid are committed before Esplora submission. Retries
   reconcile by txid (`get_tx_or_none`) and reuse the same raw hex instead of
   building a second spend. Platform wallet use is serialized (PostgreSQL
   advisory lock / process lock in tests). Paid fulfillment broadcasts **outside**
   the request-row atomic so durable writes can commit.
2. **Failure-state persistence**: wallet/API prepare failures call
   `_persist_failure` in a committed transaction after the prepare atomic ends,
   so `status=failed` is no longer rolled back by `raise`. Fee-too-high remains
   `pending` for retry. Prepared-but-unconfirmed submits stay `pending` with the
   signed payload for safe retry.
3. **Network immutability**: `set_anchor_network` freezes `btc_network` once a
   signed payload or txid exists. `EsploraClient` is selected via
   `client_for_network(anchor.btc_network)` so historical rows do not silently
   query the process-wide `BTC_API_BASE` of a different network.
4. **Reorganization handling**: `refresh_anchor_confirmations` demotes
   `anchored` → `btc_broadcast` when confirmations fall below
   `BTC_MIN_CONFIRMATIONS`, recording `reorg_demoted_at` in metadata. Public
   current-anchor GET also refreshes anchored rows.
5. **Historical evidence**: public
   `GET .../transcript/anchors/<id>/certified-text/` returns the exact UTF-8
   snapshot with `X-Text-Hash` / `X-Hash-Match` headers. The Bitcoin anchor UI
   downloads that file and runs an in-browser SHA-256 check. IPFS archival
   remains planned with the Ethereum credential work.

Paid fulfillment still rejects when the live transcript hash no longer matches
the paid request (does not silently anchor a different version).

## Validation record

Targeted suites: `content.tests_bitcoin_anchor`,
`content.tests.TranscriptAnchorModelTests`, `content.tests.TranscriptAnchorAPITests`.
After the 2026-09-23 changes, re-run:

```bash
cd acbc_app && . .venv/bin/activate && ENVIRONMENT=DEVELOPMENT \
  python manage.py test content.tests_bitcoin_anchor content.tests.TranscriptAnchorModelTests content.tests.TranscriptAnchorAPITests -v 1
```

These tests mock Esplora; they do not validate live payment providers, real
network broadcast, production credentials or concurrent PostgreSQL wallet
behavior under load.

## Next meaningful demonstration

- Run an explicitly configured signet end-to-end test, record txid, network,
  payload and confirmations, and distinguish payment approval from confirmation.
- Exercise a paid request in a test environment without charging real users.
- Demonstrate download + local hash verification after editing the live transcript,
  plus an intentionally modified-file failure.
- Complete IPFS preservation as part of the new archival work.

## Contribution history

The Bitcoin feature predates the hackathon, but not every improvement does:

- `961cd43`, 2026-09-10: automatic broadcast after payment.
- `fd90130`, 2026-09-10: platform-credit payment for Bitcoin anchors.
- `c5f3f8d`, 2026-09-14 15:35:46 UTC: show the exact hashed transcript text.
- 2026-09-23: durable broadcast/retry, failure persistence, network/Esplora
  binding, reorg demotion, certified-text download + UI hash check (this change).

Describe post-start commits as improvements to an existing feature, with the
commits as evidence; organizer eligibility decisions remain separate.
