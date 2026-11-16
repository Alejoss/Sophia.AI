# Knowledge-path funding on Bitcoin Cash

Status: **steps 1–7 implemented.** The campaign contract is proven in the Bitcoin Cash virtual machine. A live chipnet broadcast still needs a funded test wallet. The crossing pledge on mainnet needs a real wallet.

This is the BCH BLAZE 2026 plan for crowdfunding the creation of a knowledge path. Supporters lock Bitcoin Cash in a campaign coin and receive a CashToken NFT. That NFT is the reclaim ticket while the goal is unmet, and the access pass after the author claims a completed pool.

The curriculum stays on `KnowledgePath`. The campaign is a separate contract. `BchDirectPayment` stays the single-buyer checkout and does not store pledges.

## Product rules

A proposal creates a hidden knowledge path (`is_visible=False`, not for sale). The public campaign shows `frozen_title` and `frozen_pitch`, copied from the path when the campaign opens. Later edits to the draft do not change that pitch.

One campaign output holds the pool. Each pledge adds satoshis to that output and mints one CashToken NFT. The NFT commitment is 16 bytes: `bytes8(proposalId) + bytes8(amountSats)`. CashScript `bytes8` is `OP_NUM2BIN`, so each integer is an 8-byte little-endian script number. The holder of the NFT is the only person who can reclaim that pledge.

| Campaign state | New pledges | Refund | Author claim |
|---|---|---|---|
| `draft` | No | No | No |
| `open` | While the campaign coin still says open | Holder burns the NFT and receives that pledge | No |
| `funded` | Closed | Closed | Pays `author_payout_address` |
| `claimed` | Closed | Closed | Already paid |
| `expired` | Closed | Still open | No |
| `cancelled` | No | No | No |

`cancelled` is reachable only from `draft`.

The pledge that reaches `goal_sats` rewrites the campaign output to `funded` in that same transaction. Refunds close then, so the pool cannot be drained while the author is about to claim. A missed deadline moves an underfunded campaign to `expired` when someone calls `expire()`. CashScript 0.12 can require `tx.time >= deadline`, and it cannot forbid a spend after a time. A pledge can still land in the window after the deadline and before `expire()` is mined. `expire()` and `claim()` accept an optional second input so that input can pay the miner fee. The refund spend checks the campaign state and returns each pledge only to the NFT holder. Claiming spends the pot to the author and leaves every unburned NFT in place. Those NFTs unlock the path.

Losing the NFT loses the refund and, after a claim, access. A Sophia login cannot replace it.

Pledges count toward `raised_sats` only after one confirmation. `raised_sats` is the sum of pledges in `confirmed` or `settled`. A `pending` or `refunded` pledge is excluded.

## How the contract is stored

Bitcoin Cash enforces contracts as rules locked to coins. There is no Ethereum-style account that keeps a program and a storage map at an address.

The `.cash` source stays in the repository. The CashScript compiler (`cashc`) writes an artifact: bytecode plus the function list. Constructor arguments (goal, deadline, payout address) produce one instance, with a locking script and an address.

Opening a campaign sends Bitcoin Cash to that address. The resulting coin is the contract. CashScript's default lock is `p2sh32`: the coin stores a 32-byte hash of the script. The full bytecode is revealed in the transaction that spends the coin. The network checks the hash and that the script returns true. Sophia keeps the artifact and the constructor arguments so it can build the next spend.

Spending a coin destroys it. A covenant spends the campaign coin and creates a new one locked by the same rules, carrying the updated pool. The contract's memory is that coin: its satoshi value, its CashToken, and the NFT commitment (at most 40 bytes).

## Fees

Saving a draft is a database write. It does not send a transaction.

Opening the campaign is one transaction. The author pays the miner fee. A separate dust amount sits in the campaign coin so the network will accept it. That dust is locked, not spent as a fee. A successful claim returns it with the pool.

Each pledge, refund, and claim is its own transaction. The signer pays that miner fee. A pledge also creates the NFT coin, so the amount has to cover the pledge plus the NFT dust. Sophia does not add a platform fee.

## Data model

Both models live on `knowledge_paths`, next to `KnowledgePathPurchase`.

`PathProposal`

| Field | Role |
|---|---|
| `knowledge_path` | One-to-one draft path created with the proposal. Stays hidden unless a later step publishes it after `claimed`. |
| `author` | User who proposed it. |
| `frozen_title`, `frozen_pitch` | Pitch copied from the path when the campaign opens. Empty while `draft`. |
| `goal_sats` | Required amount, in satoshis. |
| `deadline` | Failure clock, stored in UTC with no microseconds. |
| `author_payout_address` | CashAddr with an explicit prefix (`bitcoincash:`, `bchtest:`, or `bchreg:`). |
| `terms_hash` | Set when the campaign opens. SHA-256 hex of `proposal_id\|goal_sats\|deadline_unix\|author_payout_address`. |
| `status` | `draft`, `open`, `funded`, `claimed`, `expired`, `cancelled`. |
| `raised_sats` | Cache recomputed from `confirmed` and `settled` pledges. |
| `campaign_txid`, `campaign_vout` | Campaign coin. Empty until open. |
| `contract_address`, `token_category` | Contract instance and the 32-byte CashToken category. Empty until open. |
| `settlement_txid` | Author claim transaction. Empty until claimed. |

`PathPledge`

| Field | Role |
|---|---|
| `proposal` | Campaign. |
| `user` | Logged-in supporter, when known. Nullable. |
| `wallet_address` | CashAddr that received the NFT. |
| `amount_sats` | Satoshis this pledge added. |
| `pledge_txid`, `vout` | Pledge output. Unique together. |
| `nft_category` | 32-byte CashToken category, hex. |
| `nft_commitment` | Hex commitment, at most 40 bytes. |
| `nft_txid`, `nft_vout` | NFT output. Unique together. |
| `status` | `pending`, `confirmed`, `refunded`, `settled`. |
| `refund_txid` | Set when the NFT is burned and the sats return. |

The Django row is an index. After the campaign is on chain, the coin and the NFT are the authority. Step 3's sync command writes these rows from chain events. The state machine in `knowledge_paths/services/proposal_service.py` applies those events and does not call Electrum.

## State machine

Implemented in `proposal_service`:

1. `create_draft` creates the hidden path and a `draft` proposal.
2. `cancel_draft` moves `draft` to `cancelled`.
3. `open_proposal` freezes the pitch, stores the campaign outpoint, and sets `terms_hash`.
4. `record_pledge` adds a pledge while `open` and before the deadline. One confirmation counts it. Crossing `goal_sats` sets `funded`.
5. `confirm_pledge` promotes a `pending` pledge once it has a confirmation, with the same goal check.
6. `refund_pledge` refunds a `confirmed` pledge while `open` or `expired`.
7. `expire_if_due` moves an underfunded `open` campaign to `expired` at the deadline. A campaign already at its goal becomes `funded` instead.
8. `claim_proposal` moves `funded` to `claimed` and every `confirmed` pledge to `settled`.

Access and publishing stay out of this step. `user_has_path_access` does not read pledges yet. The path stays invisible.

## Implementation sequence

| Step | Work | Status |
|---|---|---|
| 1 | `PathProposal`, `PathPledge`, and `proposal_service`, tested with fake chain events | Implemented |
| 2 | CashScript contract. `contracts/path-funding/scenario.mjs` runs pledge, refund, the crossing pledge, claim, and expiry in the BCH virtual machine. A funded refund and an expired claim fail. Chipnet broadcast is still outstanding | Implemented in the VM |
| 3 | `sync_path_proposals` reads the campaign coin and pledge NFTs through `payments/bch_client.py` and upserts rows. Running it twice does not duplicate pledges | Implemented |
| 4 | `user_has_path_access` allows a claimed path when the connected wallet holds that campaign's pledge NFT. The path can become visible only after `claimed` and at least one node | Implemented |
| 5 | Proposal API: create, open, list, detail, record a broadcast pledge, and return unsigned refund and claim spends | Implemented |
| 6 | Public campaign page with WizardConnect. Pledge, refund, and claim sign in the wallet. The path page asks for the same wallet | Implemented |
| 7 | `seed_path_funding_demo` creates an English draft and one text lesson. The knowledge-path list links to campaigns from its header | Implemented |

Stretch goals, comments, a campaign editor, platform fees, and an XO port are outside this sequence.

## BLAZE eligibility

The hackathon requires a public page where a judge can send a useful Bitcoin Cash mainnet transaction, with WizardConnect or an XO template. Registration is already closed. Roll call is a separate queue. The submission deadline is 22 November 2026 at 14:00 UTC (9:00 AM Guayaquil). The virtual machine proves the contract. The public campaign page is where a judge connects a wallet and sends the mainnet pledge.

EMBER2026 is the CashToken used for the Community Choice award. A project lists a CashTokens address so people can send those tokens to it. The campaign contract, the pledge NFT, and the author payout do not use that address, so the knowledge-path page does not show it.
