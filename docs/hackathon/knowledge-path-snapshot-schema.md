# Knowledge-path snapshot schema (frozen)

Status: **decided for hackathon Phase 1** (2026-09-23; terminology aligned to
knowledge path on 2026-09-23).
Companion: [Ethereum credentials](hackathon-ethereum-credentials.md),
[development plan](hackathon-ethereum-development-plan.md).

This document freezes the hashed curriculum artifact for Sophia's Crypto World's
Fair demo. Implementation of archival persistence is Phase 2; this file is the
contract those later phases must follow.

Domain language: the product has **knowledge paths** and **events**. Do not name
hashed curriculum artifacts "courses" in code, schema fields, or fixtures.

## Scope decision (hackathon)

| Artifact | Hashed immutable snapshot for hackathon? |
| --- | --- |
| Knowledge path | **Yes** — sole curriculum commitment |
| Event definitions / attendance credentials | **No** — out of hashing scope |
| Public assessments / quiz question banks | **No** — quiz *content* is not hashed |
| Credential (NFT) artifact | Yes at mint time (separate schema; see below) |

Quizzes remain **application eligibility checks** (completion still requires
perfect quiz scores under the rules below). Their questions, options and answer
keys are **not** included in the knowledge-path snapshot digest. Changing a quiz
after publication does not change the knowledge-path digest; it can still change
whether a learner is eligible to request a certificate under live app rules.
Phase 4 must bind eligibility evaluation to the published version's declared
`completionRequirements`, not to mutable quiz text.

Event certificates may continue to exist in the product, but the hackathon
demonstration and cryptographic work commit only to knowledge-path completion.

## Stable identifiers

| Entity | Format | Notes |
| --- | --- | --- |
| Knowledge path | `sophia:knowledge-path:{db_id}` | `db_id` is the `KnowledgePath.id` at first publish |
| Node | `sophia:node:{db_id}` | `Node.id`; stable across republishes of the same row |
| Content | `sophia:content:{db_id}` | Underlying `Content.id` for material provenance |
| Knowledge-path version | positive integer starting at `1` | Monotone per `knowledgePathId`; never reuse |

Do not invent content-addressed knowledge-path IDs for the demo. Registry
references on Ethereum will namespace these strings by deployment (chain ID +
contract address) outside the snapshot document.

## Knowledge-path snapshot schema (`sophia-knowledge-path-v1`)

Required top-level fields (no additional properties in the hashed document):

| Field | Type | Rule |
| --- | --- | --- |
| `schemaVersion` | string | Exactly `"sophia-knowledge-path-v1"` |
| `knowledgePathId` | string | `sophia:knowledge-path:{id}` |
| `version` | integer | `>= 1` |
| `title` | string | Full `KnowledgePath.title`; no truncation |
| `description` | string | Full description; use `""` if blank — **never `null`** |
| `publishedAt` | string | UTC ISO-8601 with `Z`, **second** precision (`YYYY-MM-DDTHH:MM:SSZ`) |
| `issuer` | object | See issuer object |
| `completionRequirements` | object | See completion requirements |
| `nodes` | array | Ordered by learning sequence (`Node.order` ascending) |

Legacy field names such as `courseId` / `sophia-course-v1` are rejected.

### Issuer object

| Field | Type | Rule |
| --- | --- | --- |
| `namespace` | string | `"sophia"` |
| `authorUserId` | integer | `KnowledgePath.author_id` at publish time |
| `authorUsername` | string | Username snapshotted at publish time (display only) |

### Completion requirements (actual platform rules)

Live unlock logic already requires every quiz on a preceding node at score
`100`. Path-complete checks incorrectly inspect only `node.quizzes.first()` in
places today. The **certified** rule for this schema is the stricter, intended
rule:

```json
{
  "allNodesRequired": true,
  "allNodeQuizzesRequired": true,
  "quizPassingScore": 100
}
```

Meaning:

1. Every node in `nodes` must be marked completed by the learner.
2. Every quiz attached to every node at **evaluation time for that published
   version** must have at least one attempt with `score == 100`.
3. There is no 80% threshold. Do not substitute other percentages.

`learningObjectives` are **not** in the schema: the database has no such field
and the hackathon will not invent unsourced curriculum claims.

### Node object

| Field | Type | Rule |
| --- | --- | --- |
| `nodeId` | string | `sophia:node:{id}` |
| `position` | integer | 1-based position in the ordered snapshot (`order` rank) |
| `title` | string | Full node title |
| `description` | string | Full text or `""` — never `null` |
| `mediaType` | string | One of `VIDEO`, `AUDIO`, `TEXT`, `IMAGE` |
| `materials` | array | Archived material references; see below |

**Not in the hashed node:** `assessments`, cover images, votes, prices,
`ContentProfile` personal notes, live URLs alone without archival.

### Material object

Each material embeds the **exact source text** for that node. IPFS pinning is
**not** part of the snapshot. Do not store `uri`, `contentHash`, or `coverage`.

| Field | Type | Rule |
| --- | --- | --- |
| `type` | string | `transcript` or `source` |
| `text` | string | Exact bytes-as-unicode to commit; **`""` if not available yet** |
| `textFormat` | string | Required for `transcript`: `"sophia-normalized-transcript-v1"`; omit for `source` |
| `contentId` | string | `sophia:content:{id}` when linked; **`""` if no content is linked** |

#### Completeness (deduced)

- **Complete:** `text` is non-empty (and `contentId` matches `sophia:content:{id}` for strict publish)
- **Incomplete:** `text` is `""`

#### Transcript verification (reconstruct the hash)

1. Take `material.text` exactly as stored (`sophia-normalized-transcript-v1`:
   already NFC + whitespace-collapsed; no BOM; no added trailing newline).
2. SHA-256 the UTF-8 encoding of that string.
3. That digest must equal Bitcoin `TranscriptAnchor.text_hash` /
   `ContentTranscript.text_hash` for the same certified text.

Anyone with the plain text and this format can reconstruct the material hash
without IPFS. The **knowledge-path digest** is separate: SHA-256 of the RFC 8785
JCS canonical form of the whole snapshot JSON (which includes those texts).

Transcript materials:

- Prefer `resolve_certified_plain_text` / the same normalization as Bitcoin.
- Optional Bitcoin tx linkage stays out of band (append-only registry evidence),
  not inside this snapshot.

Source materials (plain TEXT bodies for the hackathon):

- Embed the exact archived text in `text` the same way.
- Binary media without a transcript is incomplete until a text representation exists.

### Completeness policy

For hackathon publication of a certified version: **strict**.

- Every node must have at least one material with non-empty `text`.
- Incomplete materials (`text: ""`) are fine in author preview and **block**
  certified publication.
- Never silently omit a node.

Author testing: `GET /api/knowledge_paths/<id>/snapshot-preview/` (author/staff)
and the **Snapshot** tab on the knowledge-path edit page show the live logical
JSON, JCS canonical form, digest, and gap issues.

### Excluded from the knowledge-path digest

- Path cover images and focal points
- `is_visible`, `certificates_enabled`, prices, sales flags, purchases
- Quiz titles, questions, options, answer keys
- Learner progress, attempts, grades, PII
- IPFS CID / snapshot self-hash (stored beside the document, never inside it)
- Token IDs, transaction hashes, chain IDs

## Exact hashing conventions

### Knowledge-path snapshot JSON

1. Build the logical document conforming to `sophia-knowledge-path-v1`.
2. **Forbid floats** in the hashed document (versions and scores are integers).
3. Canonicalize with **RFC 8785 JSON Canonicalization Scheme (JCS)**.
4. Encode the canonical text as UTF-8 (no BOM).
5. `SHA-256` → 64 lowercase hex characters.
6. Upload those **exact** canonical bytes to IPFS. Persist `uri` + digest in
   application storage **outside** the document.

JCS sorts object members by name (UTF-16 code unit order). Array order is
significant: `nodes` and `materials` must already be in the intended sequence
before canonicalization. JCS does **not** Unicode-normalize string values;
preserve NFC for titles/descriptions as stored at publish time (do not apply
transcript whitespace collapse to knowledge-path JSON strings).

Pretty-printed JSON is a presentation view only unless it byte-matches the
committed canonical form. Verification downloads must offer the exact bytes.

Implementation: `knowledge_paths.knowledge_path_snapshot` and fixtures under
`docs/hackathon/fixtures/knowledge-path-snapshot-v1/`.

### Transcript material bytes

Reuse `content.transcript_utils.normalize_plain_text_for_hash` /
`compute_text_hash`. Archive the normalized UTF-8 text; do not re-normalize
differently for IPFS.

### Credential artifact (`sophia-credential-v1`)

Hashed at mint time, separate from the knowledge-path snapshot:

| Field | Type | Rule |
| --- | --- | --- |
| `schemaVersion` | string | `"sophia-credential-v1"` |
| `credentialId` | string | `sophia:credential:{uuid}` (stable issuance id) |
| `type` | string | `"knowledge_path_completion"` for the demo |
| `recipient` | string | Checksummed `0x` Ethereum address |
| `knowledgePathId` | string | Same as snapshot |
| `knowledgePathVersion` | integer | Same as snapshot |
| `knowledgePathSnapshotHash` | string | 64-hex SHA-256 of the knowledge-path canonical bytes |
| `issuedAt` | string | UTC second-precision `Z` timestamp |
| `issuer` | object | Same shape as knowledge-path issuer (snapshotted) |

Hash with the same JCS → UTF-8 → SHA-256 pipeline. Do **not** put `tokenId`,
`txHash`, or `chainId` inside the pre-mint artifact (they would be circular).
Store chain metadata beside the credential after confirmation.

Event credential types are deferred with event hashing.

## Demo path and publication rights

| Decision | Choice |
| --- | --- |
| Demo subject | One dedicated public knowledge path (not faker seed paths) |
| Working title | “Introduction to Bitcoin” (English demo materials) |
| Rights | Only author-owned or explicitly licensed public demo materials; no private paid library content |
| Certificates | `certificates_enabled=true` on the demo path |
| Language | English curriculum text for judging; UI bilingual is Phase 6 |

Seeded `populate_knowledge_paths` data is **not** the demo cohort. Phase 2 will
create or select the real path and archive its materials under this schema.

## Deployment / ops decisions (planning only)

| Topic | Decision |
| --- | --- |
| Ethereum network | Public test network for demo (default target: **Sepolia**); confirm against current track rules before deploy |
| Funds | No mainnet spend during planning; platform signer pays testnet gas at issuance |
| Pinning | Pin exact canonical bytes + material files; keep an offline/backup copy of the same bytes |
| Backup | Application-controlled object storage or repo fixtures for the demo artifacts |
| Wallet control | Before binding `recipient`, require a signature proving control of the address (SIWE or personal_sign over a server challenge); details in Phase 4 |
| Legacy certificates | Do not silently mint NFTs for pre-existing `Certificate` rows |

## Recipient wallet-control flow (summary)

1. Authenticated learner requests certificate for a published knowledge-path
   version they completed under `completionRequirements`.
2. Learner submits a recipient address and signs a challenge bound to
   `user_id` + `knowledgePathId` + `knowledgePathVersion` + address.
3. Server verifies signature, persists wallet + idempotency key, then mints.
4. Students need no ETH; the platform signer broadcasts.

## Acceptance for Phase 1

- [x] Knowledge-path-only hashing scope recorded (events and assessment content excluded)
- [x] `sophia-knowledge-path-v1` field rules and completion requirements frozen
- [x] Hashing pipeline frozen (JCS + SHA-256; transcript rules reused)
- [x] Exact-byte fixtures and deterministic tests added
- [x] Demo path policy and testnet/pinning/wallet decisions recorded
- [x] Code/schema/fixture identifiers use knowledge path, not course
- [ ] Live demo path content authored/archived (Phase 2)

## Fixture index

| File | Purpose |
| --- | --- |
| `fixtures/knowledge-path-snapshot-v1/minimal.logical.json` | Logical document (key order as authored) |
| `fixtures/knowledge-path-snapshot-v1/minimal.canonical.json` | RFC 8785 canonical bytes (single line) |
| `fixtures/knowledge-path-snapshot-v1/minimal.sha256` | Knowledge-path snapshot digest |
| `fixtures/knowledge-path-snapshot-v1/minimal.transcript-text.sha256` | SHA-256 of embedded material.text alone |
| `fixtures/knowledge-path-snapshot-v1/credential.logical.json` | Minimal credential artifact |
| `fixtures/knowledge-path-snapshot-v1/credential.canonical.json` | Canonical credential bytes |
| `fixtures/knowledge-path-snapshot-v1/credential.sha256` | Credential digest |
