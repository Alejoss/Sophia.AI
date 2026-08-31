# Pago BCH directo (autocustodia) — anclaje de transcripts

Además de [NOWPayments](nowpayments-setup.md), Academia Blockchain puede cobrar el
precio fijo de una `TranscriptAnchorRequest` (`ANCHOR_REQUEST_PRICE_USD`) en
**Bitcoin Cash** hacia una wallet propia.

## Redes (igual que Bitcoin / signet)

| Entorno | Default `BCH_NETWORK` | Verificación | Prefijo CashAddr |
|---------|----------------------|--------------|------------------|
| `ENVIRONMENT` ≠ `PRODUCTION` (Docker local) | `chipnet` | Fulcrum/Electrum (`ssl://chipnet.bch.ninja:50002`) | `bchtest:` |
| `ENVIRONMENT=PRODUCTION` (servidor) | `mainnet` | Blockchair `https://api.blockchair.com/bitcoin-cash` | `bitcoincash:` |

Override explícito: `BCH_NETWORK=chipnet` o `mainnet`. Chipnet es la red de pruebas
permanente de BCH (análogo práctico a signet para este flujo).

Faucet / explorer chipnet: [chipnet.chaingraph.cash](https://chipnet.chaingraph.cash/)

## Principios (alineados con el resto de pagos)

| Concepto | Implementación |
|----------|----------------|
| Entitlement | Mismo `TranscriptAnchorRequest` |
| Tras pagar | `paid_pending_review` vía `mark_anchor_request_paid()` (compartido con NOWPayments) |
| Admin | Aprueba/rechaza anclaje BTC como hoy (sin reembolso automático) |
| HTTP / SSL | Blockchair (mainnet) o Electrum SSL (chipnet); sin workers/IPN BCH |
| Workers / IPN BCH | No — el usuario pulsa **Ya realicé el pago** |

## Flujo

1. Usuario crea solicitud de anclaje (`pending_payment`).
2. Elige método: NOWPayments **o** BCH directo (no ambos pendientes a la vez).
3. BCH: backend asigna `expected_amount_sats` único (tasa USD→BCH + desambiguación +1 sat).
4. Usuario paga el monto exacto a la dirección de la red activa.
5. `POST .../bch/verify/` consulta Blockchair o Fulcrum; si hay match → `paid` + `paid_pending_review`.
6. Admin emite el anclaje Bitcoin (OP_RETURN) desde Django admin.

## Variables de entorno

```env
# Defaults: chipnet if ENVIRONMENT != PRODUCTION, else mainnet
# BCH_NETWORK=chipnet
# BCH_RECEIVE_ADDRESS_CHIPNET=bchtest:q...
# BCH_RECEIVE_ADDRESS_MAINNET=bitcoincash:q...
# Or a single fallback for the active network:
# BCH_RECEIVE_ADDRESS=bchtest:q...

# Optional overrides (defaults follow BCH_NETWORK):
# BCH_API_BASE=ssl://chipnet.bch.ninja:50002
# BCH_API_BASE=https://api.blockchair.com/bitcoin-cash

BCH_PAYMENT_TTL_MINUTES=30
BCH_MIN_CONFIRMATIONS=0
# 0 = fetch USD/BCH from Blockchair mainnet /stats (also used to size chipnet orders)
BCH_USD_PRICE=0
ANCHOR_REQUEST_PRICE_USD=1
```

## API

| Método | Ruta |
|--------|------|
| GET | `/api/payments/status/` → `bch_direct_enabled`, `bch_network`, `methods.bch_direct` |
| GET/POST | `/api/payments/anchor-request/<id>/bch/` |
| POST | `/api/payments/anchor-request/<id>/bch/verify/` |

## Código

- Modelo: `payments.BchDirectPayment`
- Cliente: `payments/bch_client.py` (`build_bch_client()`)
- CashAddr → scripthash: `payments/bch_cashaddr.py`
- Servicios: `payments/bch_services.py`
- UI: `frontend/src/content/AnchorPaymentCheckout.jsx`
