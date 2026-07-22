# Pasarela de pagos (NOWPayments) — BCH y Monero

Academia Blockchain usa [NOWPayments](https://nowpayments.io/) para aceptar pagos en cripto en:

1. **Registro a eventos de pago** (`EventRegistration`)
2. **Compra de Caminos del Conocimiento** (`KnowledgePathPurchase`)

## Configuración en NOWPayments

1. Crear cuenta en [NOWPayments](https://account.nowpayments.io/create-account).
2. Añadir wallets de cobro (Settings → Payments).
3. Activar las monedas deseadas en [Coin settings](https://account.nowpayments.io/coins-settings).
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

## Modelo de datos

`CryptoPayment` apunta a **exactamente uno** de estos entitlements (constraint XOR):

- `event_registration` → `events.EventRegistration`
- `path_purchase` → `knowledge_paths.KnowledgePathPurchase`

No hay FK directa a `Event` ni a `KnowledgePath`. El producto tiene `reference_price`; el entitlement guarda el estado `PENDING`/`PAID` y el snapshot del precio.

## Flujo (según [API NOWPayments](https://documenter.getpostman.com/view/7907941/2s93JusNJt))

### Eventos
1. El usuario se registra en un evento con precio > 0.
2. `POST /v1/invoice` con `price_amount`, `price_currency`, `order_id` (`evt-reg-...`), `order_description`, `ipn_callback_url`, `success_url`, `cancel_url`.
3. La respuesta incluye `id` (invoice_id) e `invoice_url`. El usuario paga en la página hospedada de NOWPayments.
4. NOWPayments crea un **payment** hijo con su propio `payment_id` cuando el usuario elige moneda y envía fondos.
5. NOWPayments envía IPN (POST) a `/api/payments/ipn/` en cada cambio de estado del **payment**.
6. El backend también consulta NOWPayments al hacer polling (`GET /api/payments/{id}/`) usando `GET /v1/invoice-payment` o `GET /v1/payment/?invoiceid=...` hasta obtener el `payment_id`.
7. Cuando el estado es `finished`, el backend marca el `EventRegistration` como `PAID` y ejecuta `on_crypto_payment_completed`.

### Caminos del Conocimiento
1. El autor define `reference_price > 0` en el camino.
2. El alumno llama `POST /api/knowledge_paths/<id>/purchase/` → crea `KnowledgePathPurchase` (`PENDING`).
3. `POST /api/payments/path-purchase/<purchase_id>/` crea la invoice (`order_id` = `kp-purchase-...`).
4. IPN/polling con status `finished` marca la compra `PAID` y desbloquea los nodos.
5. Sin compra `PAID`, `is_node_available_for_user` y el GET de nodos bloquean el acceso (el autor y miembros de book club vía `?club=` siguen con acceso).

Estados relevantes: `waiting` → `confirming` → `confirmed` → `sending` → `finished` (también `failed`, `expired`, `partially_paid`, `refunded`).

### Importante: invoice_id ≠ payment_id

Con invoices, el backend guarda primero el `invoice_id`. No uses `GET /v1/payment/{invoice_id}`: devuelve error o datos incorrectos. Hay que resolver el `payment_id` real vía IPN o `GET /v1/invoice-payment?invoiceId=...`.

## Webhook IPN

- Header: `x-nowpayments-sig`
- Firma: HMAC-SHA512 del JSON con **claves ordenadas recursivamente** e IPN secret.
- Cuerpo: mismo formato que `GET /v1/payment/{payment_id}`.
- Debe incluir `order_id` (lo enviamos al crear la invoice) para reconciliar pagos.
- Whitelist IPs NOWPayments en firewall si aplica: `51.89.194.21`, `51.75.77.69`, `138.201.172.58`, `65.21.158.36`.
- Verificar que `ACADEMIA_PUBLIC_URL` apunte al dominio público del backend y que `/api/payments/ipn/` sea accesible desde internet.

## Extender el backend al completar un pago

En `acbc_app/payments/handlers.py`:

```python
from payments.handlers import crypto_payment_completed

def my_handler(sender, crypto_payment, event_registration=None, path_purchase=None, **kwargs):
    # tu lógica: certificado, email, unlock, etc.
    pass

crypto_payment_completed.connect(my_handler)
```

También se llama `on_crypto_payment_completed()` desde `sync_payment_from_provider` (IPN y polling).

## API interna

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/payments/status/` | ¿Pasarela activa? Monedas soportadas |
| POST | `/api/payments/registration/{id}/` | Crear invoice para registro de evento |
| GET | `/api/payments/registration/{id}/list/` | Listar pagos de un registro |
| POST | `/api/payments/path-purchase/{id}/` | Crear invoice para compra de camino |
| GET | `/api/payments/path-purchase/{id}/list/` | Listar pagos de una compra |
| GET | `/api/payments/{id}/` | Estado del pago (sincroniza con NOWPayments) |
| POST | `/api/payments/ipn/` | Webhook NOWPayments (sin auth) |
| POST | `/api/knowledge_paths/{id}/purchase/` | Crear/obtener `KnowledgePathPurchase` |

## Migración

```bash
docker-compose exec backend python manage.py migrate payments
```

## Nota regulatoria

El roadmap del sitio menciona restricciones legales según país. La integración técnica no sustituye asesoría legal sobre operar pagos en cripto en tu jurisdicción.
