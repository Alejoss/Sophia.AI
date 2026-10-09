# Payments

Crypto checkout for Academia Blockchain. Complementary paths:

| Path | Use | Docs |
|------|-----|------|
| **Payphone** (Botón de pago) | Card / Payphone balance for paths, topics, events, courses, anchors, and token packages. Hosted redirect + server Confirm. | [payphone-setup.md](payphone-setup.md) |
| **NOWPayments** (hosted) | Event registrations, knowledge-path purchases, transcript-anchor requests, and platform token packages. User pays BCH or Monero on NOWPayments (token packages: BCH via the hosted invoice, no Monero in our UI). | [nowpayments-setup.md](nowpayments-setup.md) |
| **BCH directo** (self-custody) | Transcript-anchor requests, plus staff-activated knowledge paths and topic Consultas, and token packages. Exact-amount Bitcoin Cash to a platform wallet; user taps **Ya realicé el pago** (auto address-scan; TXID only after failure / support). | [bch-direct.md](bch-direct.md) |
| **Platform tokens** | Buy packages from `/acbc-tokens` (wallet in **Mis tokens**). Spend on transcript Bitcoin anchors ($1 → 100 tokens at face value). Consultas daily-limit UI links to the wallet; raising that cap with tokens is not wired yet. | [platform-tokens.md](platform-tokens.md) |
| **Monero (mensaje)** | No extra server setup. Checkout shows **Pagar con Monero**; a modal sends a direct message to user `#2` to request a wallet address. | UI only (`frontend/src/payments/MoneroPaymentModal.jsx`) |

## Unified frontend checkout

All buyer checkouts share one chooser (`ProductPaymentCheckout`) entered through thin product adapters:

| Product | Adapter | Payphone | NOW | BCH directo | Monero | Platform tokens |
|---------|---------|----------|-----|-------------|--------|-----------------|
| Knowledge path | `PathCheckout` | if for sale | if for sale | if staff flag | if for sale | no |
| Topic consultas | `TopicCheckout` | if for sale | **no** | if staff flag | if for sale | no |
| Event registration | `EventCheckout` | yes | yes | no | yes | no |
| Course (`CoursePurchase`) | `CourseCheckout` | yes | yes | when gateway BCH is configured | yes | no |
| Transcript anchor | `AnchorCheckout` | gateway | gateway | gateway | yes | yes |
| Transcript generation ($1) | `TranscriptGenerationCheckout` | gateway | gateway | gateway | yes | yes |
| Token package | `TokenCheckout` | yes | yes | yes | **no** | n/a |

Course checkout UX (`/courses/<code>/checkout`): confirm receipt email first, then open the method chooser. `CoursePurchase.receipt_email` stores the address from that step.

Method availability is centralized in `frontend/src/payments/productCatalog.js` (`resolveAvailableMethods`) and combined with `GET /payments/status/`. NOWPayments invoices use a single `paymentTarget: { kind, purchaseId }` shape (`nowpaymentsTarget.js`); legacy ID props on `CryptoPaymentModal` remain as shims.

Public paid Bitcoin anchors (`TranscriptAnchorRequest`) show a method chooser (tokens, NOWPayments, and/or BCH when configured). Crypto methods cannot both be **pending** on the same request.

After payment succeeds, the platform **automatically broadcasts** the Bitcoin OP_RETURN. Status becomes `approved` on success, or stays `paid_pending_review` if broadcast is deferred (fees/funds) for staff/ops retry. There is no automatic refund on reject.

Related:

- [Transcript certification (Bitcoin)](../hackathon/transcript-anchor.md)
- [Environment variables](../deployment/environment-variables.md#bitcoin-cash-direct-anchor-request-payments)
- API index: [endpoints.md — Payments](../api/endpoints.md#payments)
