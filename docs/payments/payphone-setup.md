# Payphone Botón de pago

Card checkout (Visa / Mastercard / Diners / Discover) and Payphone balance via [Payphone Botón de pago](https://docs.payphone.app/boton-de-pago). Recommended by Bayfront for this stack.

## Flow

1. Buyer chooses **Tarjeta de Crédito (Payphone)** in `ProductPaymentCheckout`.
2. Frontend `POST /api/payments/payphone/` with `{ kind, purchaseId }`.
3. Backend calls Payphone `POST /api/button/Prepare` and stores a `PayphonePayment`.
4. Browser redirects to `payWithCard` (full page — no iframe).
5. After payment, Payphone redirects to  
   `{ACADEMIA_PUBLIC_URL}/api/payments/payphone/return/?id=…&clientTransactionId=…`
6. Backend calls `POST /api/button/V2/Confirm` **within 5 minutes**, fulfills the entitlement, then redirects to  
   `{FRONTEND_PUBLIC_URL}/payments/payphone/result?status=approved&next=…`

Form links expire after ~10 minutes. Missing confirm → Payphone auto-reverses.

## Credentials

1. Payphone Business account + **Desarrollador** user.
2. [Payphone Developers](https://appdeveloper.payphonetodoesposible.com/) → app type **WEB**.
3. Register the **frontend domain** (production hostname or `localhost` for local).
4. Set response URL conceptually to the API return endpoint (we override `responseUrl` per Prepare call).
5. Copy **Token** and **StoreId**.

## Environment

```bash
PAYPHONE_TOKEN=your_bearer_token
PAYPHONE_STORE_ID=your_store_id
PAYPHONE_API_URL=https://pay.payphonetodoesposible.com/api
PAYPHONE_TIMEZONE_OFFSET=-5
# Optional: split buyer-facing USD total into base + IVA (e.g. 15 for Ecuador)
PAYPHONE_IVA_PERCENT=0

ACADEMIA_PUBLIC_URL=https://api.your-domain.com
FRONTEND_PUBLIC_URL=https://your-domain.com
```

`methods.payphone` on `GET /api/payments/status/` is true only when both token and store id are set.

## Products

Enabled wherever catalog rules allow (same idea as NOWPayments, plus topics):

| Product | Rule |
|---------|------|
| Path | for sale + gateway |
| Topic consultas | for sale + gateway |
| Event | gateway |
| Course | gateway |
| Transcript anchor | gateway |
| Token package | gateway |

## Frontend notes

- `index.html` sets `<meta name="referrer" content="origin">` so Payphone can validate the redirect origin.
- Do not embed Payphone URLs in iframes/webviews.
- Result page: `/payments/payphone/result`.

## Ops

- Admin: `PayphonePayment` rows (status, amounts, confirm payload).
- External notification webhook (`Notificación Externa`) is **not** required for Botón de pago; confirm-on-return is the source of truth.
- Switching methods abandons unused pending Payphone / waiting NOWPayments invoices (in-flight NOW or pending BCH still block).
