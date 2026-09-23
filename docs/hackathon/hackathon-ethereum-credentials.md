# Sophia hackathon: Ethereum educational credentials and knowledge-path evidence

Status: agreed product direction; Phase 1 knowledge-path schema frozen 2026-09-23;
archival/contract implementation still pending.
Date: 2026-09-21 (updated 2026-09-23).
Companion: [Development plan](hackathon-ethereum-development-plan.md),
[frozen knowledge-path snapshot schema](knowledge-path-snapshot-schema.md).

## Objective

Extend Sophia's learning platform with non-transferable educational certificate
NFTs on Ethereum and an immutable registry of knowledge-path versions and transcript
references. Preserve readable evidence on IPFS, retain Bitcoin transcript
anchoring, and let a learner or third party inspect exactly what a credential
refers to. A transcript is educational content; it is not the student's NFT.

The hackathon deliverable is a complete learning-to-verification experience,
not a new token economy. Contract feature count is not a success metric.

## Existing behavior and integration boundaries

| Area | Current implementation | Required extension |
| --- | --- | --- |
| Knowledge paths | `acbc_app/knowledge_paths/models.py`: editable KnowledgePath and ordered Node records | Immutable published snapshots and learner-version binding |
| Assessments | `acbc_app/quizzes/models.py`: multiple quizzes per node, questions, options and attempts | Versioned public definitions and controlled private evidence |
| Credentials | `acbc_app/certificates/models.py`: UUID, path OR event, issuer, template, file, transaction field | Wallet, network, contract, token ID, artifact hash, achievement version and status |
| Approval | `acbc_app/certificates/views.py` and CertificateRequest.approve | Consistent approved issuance across all entry points; retry-safe mint jobs |
| Transcripts | `acbc_app/content/transcript_utils.py` and ContentTranscript | Archive exact normalized bytes, not a mutable latest-content URL |
| Bitcoin | TranscriptAnchor snapshots text/hash and tracks broadcast/confirmation | Reuse matching evidence and expose network-specific verification |
| EVM | `contracts/` contains legacy/experimental contracts | New focused credential/registry implementation and deployment |

General older documentation mentions Polygon and Chainlink. The current
transcript product is Bitcoin-only; this document proposes an additional
Ethereum integration, not functionality already deployed. Existing
`Certificate.blockchain_hash` is a transaction reference, not a content digest.

## Agreed scope

Use OpenZeppelin ERC-721 and AccessControl, with ERC-5192 transfer locking.
Start with one non-upgradeable contract containing logically separate transcript,
achievement-version and educational-certificate records. Do not reuse legacy
contracts without reviewing their behavior. Pin dependency versions during implementation.

Include:

- Immutable transcript records with SHA-256 digest, IPFS URI and format version.
- Bitcoin network/transaction evidence associated with the correct digest.
- Immutable **knowledge-path** snapshots, including full titles,
  descriptions, node order, completion requirements and archived material
  references. Hackathon scope does **not** hash event definitions or quiz /
  public-assessment content (see [knowledge-path-snapshot-schema.md](knowledge-path-snapshot-schema.md)).
- Educational NFTs for knowledge-path completion (demo). Event attendance credentials may
  remain in the product without a hashed event schema for this hackathon.
- Issuer permissions scoped to the knowledge-path/event offering, with separate administration.
- Permanent non-transferability, credential validity, revocation and linked replacement.
- Stable certificate identifiers to prevent duplicate minting on retries.
- Certificate artifact hashing, separate from transcript and knowledge-path hashing.
- Platform-paid issuance, public verification and activity events.
- Emergency pause of new registry writes/minting; existing verification stays available.

Knowledge-path certificates reference a knowledge-path version. Event certificates reference a
fixed event/achievement definition; they need not invent a transcript or knowledge path.
Private personal details, answer keys and learner submissions are not public
on-chain fields or unencrypted public IPFS files.

## English and Spanish interface requirement

Added 2026-09-22 by product decision; implementation pending.

Provide a language selector in the navigation bar, available on desktop and
mobile, with clearly labeled English and Spanish choices. Selecting English must
actually translate the current page and the application's interface, not merely
change the selector label. Retain Spanish for the existing community. Remember
the choice across navigation, reloads and subsequent visits in the same browser.

Coverage includes navigation, landing pages, authentication, learning paths,
quizzes, community screens, payments, Bitcoin anchoring, educational certificates,
issuer controls and public verification. Translate application-owned headings,
buttons, forms, dialogs, validation errors, loading/empty states and notifications;
format dates and numbers appropriately and update the document language.

Content supplied by users (knowledge-path text, posts, transcripts and assessment content)
retains its original language unless a separate translation is provided. Prepare
an English demo knowledge path and label original-language content clearly. Never modify
certified snapshot bytes, hashes or archived transcripts when switching the UI
language; any translated rendition is distinct from the original evidence.

The official rules, section 12(a)(i), require submitted content in English:
[Crypto World's Fair rules](https://colosseum.com/legal/Crypto%20World%27s%20Fair%20Hackathon%20Rules.pdf).
They do not explicitly specify a navbar selector or translation of the entire
historical library. This bilingual interface is our chosen product requirement
for an English judging experience, not a claim that the rules prescribe this UI.

## Storage and data model

| Data | Storage |
| --- | --- |
| Full node/knowledge-path titles and descriptions | Canonical knowledge-path snapshot on IPFS |
| Exact archived transcripts and public source documents | Separate IPFS files with backup copies |
| Knowledge-path snapshot digest and URI | Ethereum achievement-version record |
| Transcript digest, URI, normalization version | Ethereum transcript registry |
| Bitcoin transaction and network | Associated registry evidence; verified off-chain |
| Recipient, issuer, achievement version, credential digest/URI, status | Ethereum NFT record |
| Attempts, grades, private identity and restricted assessment evidence | Controlled application storage |

The certificate points to a knowledge-path snapshot; the snapshot points to exact
archived materials. Titles and long descriptions are protected by hashing the
whole snapshot. No separate description hash or on-chain description is needed.
Preserve all materials intended to be certified. Never silently omit a node or
claim complete archival if a resource is missing. Publication must either report
the gap explicitly or block publication under a strict completeness policy.
The demo should use a knowledge path with fully available, publishable evidence.

IPFS content addressing does not guarantee availability. Maintain pinning and
backups of the exact files; verification must distinguish unavailable evidence
from a hash mismatch. Public IPFS is not an access-control system for paid knowledge paths.
Use public demo materials; restricted-material handling remains an explicit
implementation decision, not automatic publication of existing knowledge-path files.

### Illustrative knowledge-path snapshot

Authoritative field rules and fixtures live in
[knowledge-path-snapshot-schema.md](knowledge-path-snapshot-schema.md). The example below is
aligned with that freeze (placeholders are not valid CIDs or real digests).
Assessment / quiz objects are intentionally absent from the hashed document.

```json
{
  "schemaVersion": "sophia-knowledge-path-v1",
  "knowledgePathId": "sophia:knowledge-path:42",
  "version": 1,
  "title": "Introduction to Bitcoin",
  "description": "The full knowledge path description.",
  "publishedAt": "2026-10-01T15:00:00Z",
  "issuer": {
    "namespace": "sophia",
    "authorUserId": 7,
    "authorUsername": "demo-teacher"
  },
  "completionRequirements": {
    "allNodesRequired": true,
    "allNodeQuizzesRequired": true,
    "quizPassingScore": 100
  },
  "nodes": [{
    "nodeId": "sophia:node:101",
    "position": 1,
    "title": "What is Bitcoin?",
    "description": "The complete node description, without truncation.",
    "mediaType": "VIDEO",
    "materials": [{
      "type": "transcript",
      "textFormat": "sophia-normalized-transcript-v1",
      "text": "Bitcoin is a peer-to-peer electronic cash system. Transactions are broadcast to the network and confirmed in blocks.",
      "contentId": "sophia:content:55"
    }]
  }]
}
```

Final schema identifies the issuer inside the snapshot. Registry deployment /
network namespacing lives beside the document on-chain. Snapshot arrays have
deliberate order; JCS sorts object keys but does not reorder lessons. Quiz
content is not part of this digest. Private assessment data stays in controlled
application storage.

### Exact hashing conventions

1. Transcripts: reuse existing NFC plus whitespace-collapse normalization in
   `normalize_plain_text_for_hash`; encode UTF-8, without BOM or an added newline.
   Archive the exact normalized bytes. SHA-256 must equal the matching Bitcoin
   anchor's `text_hash`. Do not relabel a different transcript as that anchor.
2. Knowledge-path and credential JSON: adopt RFC 8785 JSON Canonicalization Scheme (JCS),
   serialize UTF-8 and hash the exact bytes using SHA-256. Floats are forbidden
   in hashed documents. Freeze schema rules for missing/null fields, timestamps
   and integers as in [knowledge-path-snapshot-schema.md](knowledge-path-snapshot-schema.md).
   JCS does not itself normalize Unicode; preserve strings exactly and document
   any preprocessing. Do not apply transcript whitespace collapse to knowledge-path JSON.
3. Upload those exact canonical bytes to IPFS. Store the returned URI and digest
   outside the document: a snapshot must not contain its own CID/hash.
4. Ethereum stores SHA-256 digests as 32-byte values. Do not accidentally replace
   SHA-256 with Ethereum's commonly used Keccak-256. An IPFS CID is not generally
   interchangeable with the raw-file SHA-256 digest.
5. A credential has its own finalized artifact (canonical credential JSON or
   PDF), with a declared format, URI and digest. Freeze it before minting; do not
   regenerate PDF bytes and expect the old hash to match. Keep token/transaction
   references outside any pre-mint artifact that would otherwise be circular.

Use cross-language fixtures to prove backend/browser interoperability. A
pretty-printed JSON download is a separate presentation unless it reproduces
the committed bytes. Provide the exact verification file for download.

## Publication, issuance and lifecycle

Publish a frozen knowledge-path version before the learner starts the certified path.
Bind that learner's progress to it. Later edits create a new version and never
silently migrate existing progress or rewrite issued credentials. For the demo,
freeze one knowledge path/cohort; a general path migration editor is out of scope.
Existing unversioned progress must not be retroactively presented as evidence
of a previously published immutable version.

Sophia/authorized educators determine completion using application rules and
approve issuance. The contract authenticates the issuer and records the claim;
it does not independently grade quizzes or prove a person's identity.
Verify wallet control before binding a recipient. The platform pays gas through
an authorized signer; students need no ETH to receive the token.

Submission, broadcast and confirmation are distinct states. Persist a stable
issuance key before sending a transaction, reconcile receipts after interruptions,
and prevent retries from minting twice. Track chain ID, contract and token ID
separately from transaction hashes. Replacements need new issuance IDs and a
link to the original; current per-user/path/event uniqueness needs migration design.

Revocation changes validity, not historical visibility. A revoked certificate
and its original artifact remain inspectable. Replacement marks the original
as no longer valid and identifies its successor; no ordinary transfer is enabled.
Wallet recovery requires an explicit issuer-reviewed identity process, not merely
control of a new wallet. Removing an issuer's future permissions does not
automatically revoke all past credentials. Do not introduce arbitrary expiry
or reversible revocation without a documented product rule.

Bitcoin evidence may arrive after transcript registration. Attach it as an
authorized append-only assertion/event bound to the digest, without changing
the immutable knowledge-path snapshot. Corrections preserve earlier assertions. The
verifier checks the transaction's network, payload and confirmations separately;
copying a txid into Ethereum is not a Bitcoin bridge or trustless proof.

## Verification experience

Show a readable certificate page with recipient address, issuer, achievement,
issuance date and current validity. Show the certified knowledge-path version with full
titles/descriptions, ordered lessons and completion criteria. Provide links to
archived transcripts and a download of the exact snapshot bytes.

Report separate results for credential integrity, knowledge-path-snapshot integrity,
material integrity/availability, and Bitcoin confirmation. Hash the retrieved
files rather than merely trusting a backend 'verified' flag. A changed title,
description, node order, passing score or material pointer invalidates the
snapshot digest. Changing the material bytes invalidates that material's digest.
A knowledge-path hash commits to references; it does not by itself fetch or check files.

Knowledge-path snapshots describe educational content. Educational certificate NFTs
attest to individual achievement. Neither transcript anchoring nor NFT ownership
proves educational quality, copyright ownership, or correctness of an AI answer.

## Out of scope

New ERC-20 economy, on-chain badges for every activity, governance, revenue
sharing, a Bitcoin bridge, on-chain grading/AI, and storage of full text on L1.
Keep platform credits, payments, RAG and gamification in their existing systems.

## References and event context

- [Existing Bitcoin anchoring](transcript-anchor.md)
- [Knowledge paths](../architecture/topics-and-knowledge-paths.md)
- [Current platform credits](../payments/platform-tokens.md)
- [ERC-721](https://eips.ethereum.org/EIPS/eip-721)
- [ERC-5192](https://eips.ethereum.org/EIPS/eip-5192)
- [RFC 8785 / JCS](https://www.rfc-editor.org/rfc/rfc8785)
- [OpenZeppelin](https://docs.openzeppelin.com/contracts/5.x/)
- [Colosseum hackathon](https://colosseum.com/hackathon)

Crypto World's Fair submission deadline previously verified: October 12, 2026,
11:59 p.m. Pacific (October 13, 1:59 a.m. mainland Ecuador). Confirm event-specific
Ethereum track and deployment requirements before final deployment. Disclose
Sophia's pre-existing code and identify work performed during the competition.
This architecture defines technical scope, not a guarantee of eligibility or prizes.
