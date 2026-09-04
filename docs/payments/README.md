# Payments

Crypto checkout for Academia Blockchain. Three complementary paths:

| Path | Use | Docs |
|------|-----|------|
| **NOWPayments** (hosted) | Event registrations, knowledge-path purchases, and transcript-anchor requests. User pays BCH or Monero on NOWPayments. | [nowpayments-setup.md](nowpayments-setup.md) |
| **BCH directo** (self-custody) | Transcript-anchor requests, plus staff-activated knowledge paths and topic Consultas. Exact-amount Bitcoin Cash to a platform wallet; user taps **Ya realicé el pago**. | [bch-direct.md](bch-direct.md) |
| **Monero (mensaje)** | No extra server setup. Checkout shows **Pagar con Monero**; a modal sends a direct message to user `#2` to request a wallet address. | UI only (`frontend/src/payments/MoneroPaymentModal.jsx`) |

Public paid Bitcoin anchors (`TranscriptAnchorRequest`) show a method chooser when both are configured. The two methods cannot both be **pending** on the same request.

After either payment succeeds, the request is `paid_pending_review`. Staff approve (broadcast OP_RETURN) or reject in Django admin. There is no automatic refund.

Related:

- [Transcript certification (Bitcoin)](../api/transcript-anchor.md)
- [Environment variables](../deployment/environment-variables.md#bitcoin-cash-direct-anchor-request-payments)
- API index: [endpoints.md — Payments](../api/endpoints.md#payments)
