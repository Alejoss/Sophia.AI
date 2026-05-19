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

## Flujo

1. El usuario se registra en un evento con precio > 0.
2. Elige **BCH** o **XMR** y el backend crea un pago en NOWPayments.
3. Se muestra dirección, monto y enlace de factura (si aplica).
4. Al confirmarse el pago (`finished` / `confirmed`), el IPN o el polling actualiza `payment_status` a `PAID`.

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
