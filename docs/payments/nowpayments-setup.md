# Pasarela de pagos (NOWPayments) — BCH y Monero

Academia Blockchain usa [NOWPayments](https://nowpayments.io/) para aceptar **Bitcoin Cash (BCH)** y **Monero (XMR)** en el registro a eventos de pago.

## Configuración en NOWPayments

1. Crear cuenta en [NOWPayments](https://account.nowpayments.io/create-account).
2. Añadir wallets de cobro para **BCH** y **XMR** (Settings → Payments).
3. Activar BCH y XMR en [Coin settings](https://account.nowpayments.io/coins-settings).
4. Generar **API Key** y **IPN Secret** (Payment Settings).
5. En el panel, IPN callback URL (opcional si ya se envía por API):
   `https://TU-DOMINIO/api/payments/ipn/`

## Variables de entorno (`acbc_app/.env`)

```env
NOWPAYMENTS_API_KEY=tu_api_key
NOWPAYMENTS_IPN_SECRET=tu_ipn_secret
NOWPAYMENTS_API_URL=https://api.nowpayments.io/v1
ACADEMIA_PUBLIC_URL=https://academiablockchain.com
FRONTEND_PUBLIC_URL=https://academiablockchain.com
```

En desarrollo puedes usar el sandbox:

```env
NOWPAYMENTS_API_URL=https://api-sandbox.nowpayments.io/v1
ACADEMIA_PUBLIC_URL=http://localhost:8000
FRONTEND_PUBLIC_URL=http://localhost:5173
```

> Los webhooks IPN **no llegan a localhost** sin túnel (ngrok, cloudflared, etc.). En local puedes depender del polling del frontend o exponer el backend con un túnel.

## Flujo (según [API NOWPayments](https://documenter.getpostman.com/view/7907941/2s93JusNJt))

1. El usuario se registra en un evento con precio > 0.
2. `POST /v1/payment` con `price_amount`, `price_currency`, `pay_currency`, `order_id`, `order_description`, `ipn_callback_url`.
3. La respuesta incluye `payment_id`, `pay_address`, `pay_amount`, `payment_status` (inicialmente `waiting`).
4. El usuario envía cripto a `pay_address`.
5. NOWPayments envía IPN (POST) a `/api/payments/ipn/` en cada cambio de estado.
6. Cuando el estado es `finished` o `confirmed`, el backend marca el registro como `PAID` y ejecuta `on_crypto_payment_completed`.

Estados relevantes: `waiting` → `confirming` → `confirmed` → `sending` → `finished` (también `failed`, `expired`, `partially_paid`, `refunded`).

## Webhook IPN

- Header: `x-nowpayments-sig`
- Firma: HMAC-SHA512 del JSON con **claves ordenadas recursivamente** e IPN secret.
- Cuerpo: mismo formato que `GET /v1/payment/{payment_id}`.
- Whitelist IPs NOWPayments en firewall si aplica: `51.89.194.21`, `51.75.77.69`, `138.201.172.58`, `65.21.158.36`.

## Extender el backend al completar un pago

En `acbc_app/payments/handlers.py`:

```python
from payments.handlers import crypto_payment_completed

def my_handler(sender, crypto_payment, registration, **kwargs):
    # tu lógica: certificado, email, etc.
    pass

crypto_payment_completed.connect(my_handler)
```

También se llama `on_crypto_payment_completed()` desde `sync_payment_from_provider` (IPN y polling).

## API interna

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/payments/status/` | ¿Pasarela activa? Monedas soportadas |
| POST | `/api/payments/registration/{id}/` | Crear pago (`pay_currency`: `bch` \| `xmr`) |
| GET | `/api/payments/{id}/` | Estado del pago (sincroniza con NOWPayments) |
| POST | `/api/payments/ipn/` | Webhook NOWPayments (sin auth) |

## Migración

```bash
docker-compose exec backend python manage.py migrate payments
```

## Nota regulatoria

El roadmap del sitio menciona restricciones legales según país. La integración técnica no sustituye asesoría legal sobre operar pagos en cripto en tu jurisdicción.
