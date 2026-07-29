# Blockchain Integration

Blockchain touchpoints for Sophia.AI Academia Blockchain.

## Product path today: Bitcoin transcript certification

**Transcript certification anchors the SHA-256 `text_hash` of a content
transcript in a Bitcoin `OP_RETURN`.** There is no EVM registry for this flow.

| Piece | Role |
|-------|------|
| `TranscriptAnchor` | Snapshot of hash + BTC tx metadata (`pending` → `btc_broadcast` → `anchored`) |
| HTTP API | Prepare / list anchors (does not broadcast) |
| `content.bitcoin` | Build/sign OP_RETURN tx via platform WIF + Esplora (mempool.space) |
| `broadcast_transcript_anchor` | Ops command to broadcast and refresh confirmations |
| UI panel | Shows status; creates pending rows for uploader/staff |

Full contract (payload format, endpoints, CLI): **[transcript-anchor.md](../api/transcript-anchor.md)**.

Env: [Bitcoin OP_RETURN](../deployment/environment-variables.md#bitcoin-op_return-transcript-anchoring).

```mermaid
flowchart LR
  Transcript[ContentTranscript.text_hash] --> Pending[TranscriptAnchor pending]
  Pending --> Broadcast[OP_RETURN broadcast]
  Broadcast --> Confirmed[anchored on Bitcoin]
  Confirmed --> Verify[Anyone recomputes SHA-256]
```

Recommended test network: **signet**. Production target: Bitcoin **mainnet** when
the platform wallet and ops runbook are ready.

---

## Secondary / legacy: EVM contracts (Polygon, Hardhat)

Smart contracts under `contracts/contracts/` support platform parameters, token,
and experimental/document-hash work — **not** the current transcript
certification path.

### Contracts (examples)

- **SophiaAIParams**: Platform parameters, costs, earnings
- **HashStore**: Document hashes on-chain (legacy / experimental)
- **ACBCToken**: Token contract
- **SophiaAIParamsConsumer**: Chainlink Functions consumer

Draft / broken Chainlink samples live under `contracts/drafts/` and should not
be compiled as part of the product path.

### Backend Web3 helpers

Code under `acbc_app/content/web3/` (`web3_utils.py`, `contract_abis.py`,
`interact_with_sc.py`, …) talks to those EVM contracts when used.

### Networks (Hardhat)

Configured in `contracts/hardhat.config.js`:

- Hardhat local — chain ID `31337`
- Polygon Amoy — `80002`
- Polygon mainnet — `137`

```bash
cd contracts
npx hardhat node
npx hardhat run scripts/ParamsDeploy.js --network localhost
```

### Chainlink Functions

Used for external data (e.g. price feeds) in the EVM experiments — not required
for Bitcoin transcript anchoring.

## Security Considerations

1. **Bitcoin WIF** (`BTC_PRIVATE_KEY_WIF`): platform fee-payer only; never commit
   or expose to the frontend
2. **EVM keys**: same rule for any deploy/signing keys
3. Prefer **signet** until mainnet ops are deliberate
4. Handle Esplora / network failures with clear `failed` status and retries

## Related Documentation

- [Transcript certification (Bitcoin)](../api/transcript-anchor.md)
- [Transcript ingest](../api/transcript-ingest.md)
- [Environment variables](../deployment/environment-variables.md)
- [Contract Development](../development/contracts/contracts.md) (if present)
- [Backend Web3 Integration](../development/backend/web3-integration.md) (EVM helpers)

