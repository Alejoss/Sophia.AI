# Payphone Botón de pago

Backend integration for [Payphone Botón de pago](https://docs.payphone.app/boton-de-pago) is **installed but inactive** in the buyer checkout.

Card checkout in the UI currently uses the same operator-message flow as Monero (`Tarjeta de Crédito` → DM to user `#2`). Keep the Payphone env vars and API code if you want to re-enable hosted card redirect later.

## Current buyer flow (message)

1. Buyer chooses **Tarjeta de Crédito** in `ProductPaymentCheckout`.
2. A modal prefills a message and sends it to the platform operator (user id `2`), same as Monero.
3. You reply with payment instructions and unlock access manually after payment.

## Installed backend (dormant)

These pieces remain in the repo for a future switch-back:

- Model `PayphonePayment`, client `payphone_client.py`, services, admin
- `POST /api/payments/payphone/`, `GET /api/payments/payphone/return/`, detail route
- `methods.payphone` on `GET /api/payments/status/` when credentials are set
- Result page route `/payments/payphone/result`

Checkout catalog sets `payphone: false` for every product so the hosted button is not offered.

## Credentials (for a future re-enable)

1. Payphone Business account + **Desarrollador** user.
2. [Payphone Developers](https://appdeveloper.payphonetodoesposible.com/) → app type **WEB**.
3. Register the **frontend domain**.
4. Copy **Token** and **StoreId** into `acbc_app/.env`:

```bash
PAYPHONE_TOKEN=your_bearer_token
PAYPHONE_STORE_ID=your_store_id
PAYPHONE_API_URL=https://pay.payphonetodoesposible.com/api
PAYPHONE_TIMEZONE_OFFSET=-5
PAYPHONE_IVA_PERCENT=0

ACADEMIA_PUBLIC_URL=https://api.your-domain.com
FRONTEND_PUBLIC_URL=https://your-domain.com
```

To turn hosted Payphone back on later: set catalog `payphone` rules again (and restore the Prepare/redirect UI in `ProductPaymentCheckout`), then use the Prepare → redirect → Confirm flow documented in earlier commits / Payphone docs.
