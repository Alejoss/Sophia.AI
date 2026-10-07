# Ethereum hackathon development plan

Status: Phase 1 schema freeze recorded 2026-09-23. Phase 3 credential contract
deployed to Sepolia on 2026-10-01. Phase 2 archival remains partial. Phases 4–7
still pending.
Date: 2026-09-21 (updated 2026-10-01).
Specification: [Ethereum credentials and evidence](hackathon-ethereum-credentials.md).
Frozen schema: [Knowledge-path snapshot schema](knowledge-path-snapshot-schema.md).

## Preparation completed

Reviewed knowledge-path/node models, quiz models, certificate models and issuance
entry points, transcript normalization and Bitcoin snapshot fields. Added
explanatory docstrings at these integration boundaries before writing this plan.
No runtime behavior, database schema or deployed contract was changed.

Bitcoin anchor reliability hardening landed 2026-09-23 (see
[Bitcoin readiness](bitcoin-anchor-readiness.md)); it is separate from this
Ethereum curriculum-commitment work.

## 1. Freeze schemas and demo policy — decided 2026-09-23

Hackathon hashing scope (product decision):

- **Hash knowledge paths only** (not events).
- Do **not** hash event definitions or public-assessment / quiz content for the
  hackathon. Quizzes remain live eligibility checks; their text is outside the
  knowledge-path digest.
- Still define a separate **credential artifact** hash at mint time
  (`sophia-acbc-credential-v1`), which references the knowledge-path digest.
- Code, schema fields and fixtures use **knowledge path** naming — not "course".

Recorded in [knowledge-path-snapshot-schema.md](knowledge-path-snapshot-schema.md):

- `sophia-acbc-knowledge-path-v1` field rules, stable IDs, issuer object, materials.
- Completion requirements frozen to platform reality: all nodes, **all** node
  quizzes, `quizPassingScore: 100` (not 80%).
- Canonicalization: RFC 8785 JCS → UTF-8 → SHA-256; transcript materials reuse
  `normalize_plain_text_for_hash`.
- Exact-byte fixtures under `fixtures/knowledge-path-snapshot-v1/` with tests in
  `knowledge_paths.tests_knowledge_path_snapshot`.
- Demo policy: dedicated public “Introduction to Bitcoin” path with author-owned
  or licensed materials; faker seed paths are not the demo cohort.
- Test network target Sepolia (confirm track rules), pinning + offline backup of
  exact bytes, SIWE/personal_sign wallet-control before binding recipient.

Done for Phase 1 documentation and fixtures. **Not done:** authoring/archiving
the live demo path materials (starts Phase 2).

## 2. Implement immutable archival and learner-version binding

**Partial (2026-09-23):** admin-triggered Postgres persistence of immutable
`PublishedKnowledgePathSnapshot` rows (`document_text` TextField = exact JCS
bytes + `digest`). Dashboard: `/dashboard/snapshots`. Not created on path
create/visibility. Still TODO: learner-version binding, IPFS packaging of the
snapshot artifact (optional), dedicated demo path rights workflow.

- Persist published knowledge-path achievement versions and material snapshots
  from `sophia-acbc-knowledge-path-v1`; never depend on mutable knowledge-path records
  to reconstruct a historical certificate.
- Export full path/node text with embedded transcript text; do not archive quiz
  banks into the knowledge-path digest (hackathon scope).
- Reuse transcript normalization and exact anchor text where hashes match.
- Upload exact bytes, verify retrieval and hashes, and retain backups (optional IPFS).
- Bind learner progress to the published version; block silent mixing of versions.
- Define retention independent of deletion of editable knowledge-path/content records.
- Provide explicit completeness errors; strict policy blocks publish on gaps.
- Author/select the dedicated “Introduction to Bitcoin” demo path with
  publication rights.

Done when editing live titles, lessons or materials leaves the old archived
version and its assigned learner progress unchanged.

## 3. Implement the contract

**Deployed to Sepolia on 2026-10-01.** Unit tests passed locally on 2026-09-30.

`contracts/contracts/ACBCSophiaCredentialRegistry.sol` is a non-upgradeable ERC-721
and ERC-5192 registry (OpenZeppelin 5.0.2). One contract keeps separate
transcript, knowledge-path achievement-version, and credential records.
`contracts/test/ACBCSophiaCredentialRegistry.js` covers unauthorized actions, every
transfer and approval path, duplicate issuance, version immutability, scoped
issuance, replacement, revocation, and pause. Deployed bytecode is about 23.6 KiB,
under the 24 KiB limit, with little spare room.

Sepolia deployment, recorded in `contracts/deployments/sepolia-credential-registry.json`:

| | |
| --- | --- |
| Contract | `0xf13a2ece9747Dd286fE3e1d5C6179A875c843944` |
| Admin | `0xA75dA0D7DdEa2B5b343bf1b83f9D4474C1c7595C` |
| Transaction | `0x4ff58112d3152b3814f6b996e21ff6f079b9f24858c5ad81fcdee0848e41646f` |
| Block | 11822909 |

The admin address holds `DEFAULT_ADMIN_ROLE` only. Registrar, evidence, pauser, and issuer roles are not granted yet. The platform mint service is still pending.

Permissions, recorded in the contract NatSpec:

- `DEFAULT_ADMIN_ROLE` grants roles and may revoke any credential. It does not
  register versions, append Bitcoin evidence, mint, or replace unless it also holds that role.
- `REGISTRAR_ROLE` registers immutable transcripts and knowledge-path versions.
- `EVIDENCE_ROLE` appends Bitcoin network and transaction strings. Earlier
  assertions stay in place.
- `PAUSER_ROLE` pauses new registrations, evidence, mints, and replacements.
  Revocation and views stay available while paused.
- `issuerRole(knowledgePathId)` mints, replaces, and revokes only that path.
  Removing the role does not change tokens already issued.

The contract stores declared SHA-256 digests and URIs. It does not fetch IPFS,
recompute hashes, grade quizzes, or prove a Bitcoin transaction. The platform
mint service remains a later phase.

Registering a knowledge-path version on the contract is not part of taking a
snapshot. Staff may store many snapshots while testing. A later action chooses
one stored snapshot and asks the platform signer to call
`registerAchievementVersion`. That call spends gas, so it stays separate from
snapshot storage and from Bitcoin anchoring.

## 4. Integrate approvals and reliable minting

- Route path approvals, event approvals and direct event generation through one
  issuance service; retain existing educational eligibility checks.
- Persist recipient wallet, artifact, version and idempotency key before broadcast.
- Platform signer pays gas. Keep signing secrets server-side.
- Persist chain/contract/token/transaction separately and reconcile confirmation,
  reverts, timeouts and restarts. A database approval is not a confirmed NFT.
- Design migrations for existing certificates and per-user uniqueness before
  enabling replacements; do not silently mint legacy records.

Done when repeating approvals/jobs cannot duplicate NFTs and failed transactions
can be retried or reconciled without losing the original approved credential.

## 5. Build public verification and issuer controls

- Add certificate receipt/verification links to existing learner certificate UI.
- Render the fixed snapshot, not current database knowledge-path metadata.
- Implement independent byte hashing and exact artifact downloads.
- Show separate validity, evidence availability, hash match and Bitcoin statuses.
- Add issuer issuance/status actions and clearly explain non-transferability.
- Keep personal data and restricted quiz content out of public exports.

Done when another person can verify the demo certificate and read its preserved
curriculum without logging into Sophia; missing files and changed bytes produce
different, understandable results.

## 6. Implement the English/Spanish navbar language selector

Required hackathon deliverable, added 2026-09-22; not yet implemented.
See [language scope and evidence rules](hackathon-ethereum-credentials.md#english-and-spanish-interface-requirement).

- Inventory application-owned text across routes and shared components; use
  shared translation resources rather than separate copies of pages.
- Add an accessible English/Spanish selector to desktop and mobile navigation.
- Selecting English translates the current page immediately and applies to
  subsequent routes, dialogs, form validation and user-facing API errors.
- Persist the preference across reloads and browser visits, preserve the current
  route and unsaved form state, and support switching back to Spanish.
- Translate all covered interface states, including errors, notifications,
  loading indicators and empty screens; localize dates/numbers and document lang.
- Prepare an English demo knowledge path. Clearly distinguish original user content from
  translated UI; do not silently translate or mutate certified artifacts.

Acceptance criteria:

- A visitor can switch to English from the navbar on desktop and mobile and see
  the entire application-owned interface on the current page change to English.
- Navigation, reload, and a return visit retain English; switching back restores
  Spanish without losing current page or form state.
- The judge can complete sign-in, learning, payment/anchoring and certificate
  verification flows with English interface text, including failure states.
- Keyboard operation and accessible labels work; the document language matches.
- Automated locale coverage checks catch missing translations, and browser checks
  exercise both languages. No untranslated Spanish interface text remains in the
  English demo flow; original-language user content is identified as such.
- Hash verification produces identical results before and after changing locale.

## 7. Validate and prepare the submission

- Backend tests: snapshot consistency, learning-version binding, publication
  permissions, approval integration, recovery policy and transaction retries.
- Cross-language fixtures: accented Unicode, whitespace, long descriptions,
  multiple nodes/quizzes, deterministic JSON and exact transcript bytes.
- Contract tests: permissions, invariants and complete certificate lifecycle.
- Frontend language tests: selector behavior, persistence, both locales, translated
  error states and unchanged certified evidence.
- Browser demo: completion -> approval -> mint -> verify -> inspect archived
  materials -> show Bitcoin evidence; demonstrate a changed-file failure.
- Verify retrieval using backup/pinning recovery and verify deployed source and
  network labels. Check gas usage before considering a mainnet deployment.
- Write operations instructions for signers, issuer roles, pinning, reconciliation
  and emergency pause. Record deployment addresses and dependency versions.
- Prepare pitch, demo videos and submission with an explicit pre-existing/new-work
  boundary and actual user feedback. Confirm current event rules at submission.

Done when one complete, tested learning-to-verification flow works on the chosen
network and the submission describes its capabilities and limits accurately.

## Weekly builder-video evidence

Use actual commit messages and diffs as the basis for each weekly one-minute
video. Record the week's date range, commit IDs, user-visible changes, relevant
test results, remaining obstacles and next steps. Check diffs rather than relying
on titles alone; distinguish implemented, tested, deployed and planned work.
Include legitimate uncommitted work as such, without inventing commit IDs.
Do not count old features as new or create cosmetic work solely to imply progress.
The Bitcoin baseline and new review findings are recorded in
[Bitcoin anchoring readiness](bitcoin-anchor-readiness.md).

Suggested timing: 10 seconds of context, 30 seconds of changes/demo, 10 seconds
of challenges or user feedback, and 10 seconds of next steps. Record weekly
updates in English. A weekly update is separate from the final pitch/demo.

## Scope boundaries

Prioritize knowledge-path completion and evidence verification as the main demonstration.
Keep event credentials compatible with the data model without expanding into a
new events product. Defer rewards tokens, marketplaces, bridges and governance.
Track outstanding decisions in this document as implementation resolves them;
do not describe planned states as already operational in general documentation.
