# Environment Variables Reference

This document provides a complete reference for all environment variables used in the Sophia.AI Academia Blockchain platform.

## Backend Environment Variables

Location: `acbc_app/.env`

### Required Variables

#### `ACADEMIA_BLOCKCHAIN_SKEY`
- **Description**: Django secret key for cryptographic signing
- **Required**: Yes
- **Default**: `django-insecure-development-key-123` (development only)
- **Example**: `ACADEMIA_BLOCKCHAIN_SKEY=your-secret-key-here`
- **Generate**: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`

#### `ENVIRONMENT`
- **Description**: Application environment
- **Required**: Yes
- **Options**: `DEVELOPMENT`, `PRODUCTION`
- **Default**: `DEVELOPMENT`
- **Example**: `ENVIRONMENT=PRODUCTION`

### Database Configuration

#### `DB_NAME`
- **Description**: PostgreSQL database name
- **Required**: Yes (when ENVIRONMENT=PRODUCTION)
- **Default**: `acbc_db` (from docker-compose)
- **Example**: `DB_NAME=academiablockchain_db`

#### `DB_USER`
- **Description**: PostgreSQL database user
- **Required**: Yes (when ENVIRONMENT=PRODUCTION)
- **Default**: `postgres` (from docker-compose)
- **Example**: `DB_USER=postgres`

#### `DB_PASSWORD`
- **Description**: PostgreSQL database password
- **Required**: Yes (when ENVIRONMENT=PRODUCTION)
- **Default**: `postgres` (from docker-compose)
- **Example**: `DB_PASSWORD=secure_password_123`
- **Note**: Avoid special characters that cause issues with Docker Compose variable expansion (`$`, `!`, `%`, `` ` ``). Recommended: use letters, numbers, and safe special characters like `-`, `_`, `.`, `@`, `#`

#### `DB_HOST`
- **Description**: PostgreSQL database host
- **Required**: Yes (when ENVIRONMENT=PRODUCTION)
- **Default**: `postgres` (from docker-compose)
- **Example**: `DB_HOST=localhost` or `DB_HOST=postgres`

#### `DB_PORT`
- **Description**: PostgreSQL database port
- **Required**: No
- **Default**: `5432`
- **Example**: `DB_PORT=5432`

#### `POSTGRES_DB`
- **Description**: PostgreSQL database name (for docker-compose)
- **Required**: No (set in docker-compose.yml)
- **Default**: `acbc_db`
- **Example**: `POSTGRES_DB=acbc_db`

#### `POSTGRES_USER`
- **Description**: PostgreSQL user (for docker-compose)
- **Required**: No (set in docker-compose.yml)
- **Default**: `postgres`
- **Example**: `POSTGRES_USER=postgres`

#### `POSTGRES_PASSWORD`
- **Description**: PostgreSQL password (for docker-compose)
- **Required**: No (set in docker-compose.yml)
- **Default**: `postgres`
- **Example**: `POSTGRES_PASSWORD=postgres`

### Django Settings

#### `DEBUG`
- **Description**: Enable Django debug mode
- **Required**: No
- **Default**: `True` (development), `False` (production)
- **Example**: `DEBUG=False`

#### `ALLOWED_HOSTS`
- **Description**: Comma-separated list of allowed hostnames
- **Required**: No
- **Default**: `localhost,127.0.0.1,0.0.0.0`
- **Example**: `ALLOWED_HOSTS=example.com,www.example.com`

#### `USE_HTTPS`
- **Description**: When `true` in production, JWT/cookie secure flags are enabled. Set for HTTPS.
- **Required**: No
- **Default**: `true` when `ENVIRONMENT=PRODUCTION`
- **Example**: `USE_HTTPS=true`

#### `CORS_ALLOWED_ORIGINS`
- **Description**: Extra CORS origins in production (comma-separated). Base list is in settings.
- **Required**: No
- **Example**: `CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com`

### Google OAuth (Optional)

#### `GOOGLE_OAUTH_CLIENT_ID`
- **Description**: Google OAuth 2.0 Client ID
- **Required**: No (required for Google OAuth login)
- **Example**: `GOOGLE_OAUTH_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com`
- **Get from**: [Google Cloud Console](https://console.cloud.google.com/)

#### `GOOGLE_OAUTH_SECRET_KEY`
- **Description**: Google OAuth 2.0 Client Secret
- **Required**: No (required for Google OAuth login)
- **Example**: `GOOGLE_OAUTH_SECRET_KEY=GOCSPX-abcdefghijklmnop`
- **Get from**: [Google Cloud Console](https://console.cloud.google.com/)

### Transcript ingest (external workers)

#### `TRANSCRIPT_INGEST_API_KEY`
- **Description**: Shared secret for machine-to-machine access to `/api/content/transcript-ingest/` and `/api/content/embedding-ingest/`. External workers authenticate with header `X-Transcript-Ingest-Key: <key>` or `Authorization: Bearer <key>`. If unset/empty, all ingest endpoints return 403.
- **Required**: No (required to run transcript/embed workers against this API)
- **Example**: `TRANSCRIPT_INGEST_API_KEY=long-random-secret`
- **Note**: Workers with AWS credentials use the S3 `file_key` from the queue response to download media; this key only gates the Django ingest API.

### Qdrant Cloud (topic embeddings)

Vectors live in Qdrant; Django only stores `ContentTranscript.embedding_*` metadata and queries Qdrant for RAG.

#### `QDRANT_URL`
- **Description**: Qdrant Cloud cluster HTTPS endpoint (Overview → Endpoint). No trailing slash.
- **Required**: No (required for topic vector search / `check_qdrant`)
- **Example**: `QDRANT_URL=https://9032e54e-….us-west-2-0.aws.cloud.qdrant.io`

#### `QDRANT_API_KEY`
- **Description**: API key from the cluster **API Keys** tab
- **Required**: No (required with `QDRANT_URL`)
- **Example**: `QDRANT_API_KEY=eyJ…`

#### `QDRANT_COLLECTION`
- **Description**: Collection name for topic chunks
- **Required**: No
- **Default**: `sophia_acbc_topic_chunks`
- **Example**: `QDRANT_COLLECTION=sophia_acbc_topic_chunks`

#### `QDRANT_VECTOR_SIZE`
- **Description**: Embedding dimensions (must match the embed model)
- **Required**: No
- **Default**: `3072` (`text-embedding-3-large`)
- **Example**: `QDRANT_VECTOR_SIZE=3072`

Verify locally/prod:

```bash
docker compose exec backend python manage.py check_qdrant
docker compose exec backend python manage.py check_qdrant --ensure-collection
docker compose exec backend python manage.py check_qdrant --topic-id 2
```

### Topic RAG chat (OpenAI)

#### `OPENAI_API_KEY`
- **Description**: OpenAI API key for query embeddings + chat completions on topic RAG
- **Required**: No (required for `POST /api/content/topics/{id}/chat/`)
- **Example**: `OPENAI_API_KEY=sk-…`

#### `OPENAI_EMBEDDING_MODEL`
- **Description**: Must match the model used by the embed worker (same dims as Qdrant)
- **Default**: `text-embedding-3-large`

#### `OPENAI_CHAT_MODEL`
- **Description**: Chat model for grounded answers
- **Default**: `gpt-4o-mini`

#### `TOPIC_CHAT_TOP_K`
- **Description**: Max chunks kept after retrieval/dedupe (fetch is `2 × TOP_K`, max 2 per content)
- **Default**: `4`

#### `TOPIC_CHAT_MIN_SCORE`
- **Description**: Minimum Qdrant cosine score for dense hits; keyword-fallback windows bypass this floor. If nothing passes, the chat model is not called.
- **Default**: `0.30`

#### `TOPIC_CHAT_MAX_CONTEXT_CHARS`
- **Description**: Hard cap on context characters; only whole chunks are included (no partial truncation)
- **Default**: `12000`

See [topic-rag-chat.md](../operations/topic-rag-chat.md).

### Bitcoin OP_RETURN (transcript anchoring)

Platform wallet embeds `ACBC1` + SHA-256 digest in a Bitcoin `OP_RETURN`. Default public API: [mempool.space](https://mempool.space) Esplora. Recommended test network: **signet**. Full product/API/ops guide: [transcript-anchor.md](../api/transcript-anchor.md). Architecture: [blockchain-integration.md](../architecture/blockchain-integration.md).

#### `BTC_NETWORK`
- **Description**: `signet` (default), `testnet`, `testnet4`, or `mainnet`
- **Required**: No
- **Default**: `signet`

#### `BTC_PRIVATE_KEY_WIF`
- **Description**: WIF private key for the platform P2WPKH address that pays fees
- **Required**: Yes to broadcast (not needed for unit tests with mocks)
- **Example**: `BTC_PRIVATE_KEY_WIF=c...` (signet/testnet WIF)

#### `BTC_API_BASE`
- **Description**: Esplora REST base URL
- **Required**: No
- **Default**: `https://mempool.space/signet/api` when `BTC_NETWORK=signet`

#### `BTC_MIN_CONFIRMATIONS` / `BTC_FALLBACK_FEE_SAT_VB`
- **Defaults**: `1` / `25` (sat/vB; used only if Esplora fee estimates are unavailable)

#### `BTC_MAX_FEE_USD` / `BTC_USD_PRICE`
- **`BTC_MAX_FEE_USD`**: reject broadcast when estimated fee exceeds this USD amount (default `1`; `0` disables).
- **`BTC_USD_PRICE`**: optional fixed USD/BTC for that check; `0` (default) fetches live from `https://mempool.space/api/v1/prices`.
- On reject, API returns **503** with message: *Las comisiones por transacción están muy altas por el momento, por favor vuelve a intentarlo más tarde* (`code: fee_too_high`). Row stays `pending`.

```bash
# Local / server Docker (service name: backend)
docker compose exec backend python manage.py broadcast_transcript_anchor --show-address
docker compose exec backend python manage.py broadcast_transcript_anchor 123 --create --dry-run
docker compose exec backend python manage.py broadcast_transcript_anchor 123 --create
docker compose exec backend python manage.py broadcast_transcript_anchor 123 --refresh

# Production compose file (if used)
# docker compose -f docker-compose.prod.yml --env-file .env.compose exec backend python manage.py broadcast_transcript_anchor --show-address
```

### Bitcoin Cash direct (anchor request payments)

Self-custody exact-amount BCH for `TranscriptAnchorRequest` only (events and knowledge paths stay on NOWPayments). See [bch-direct.md](../payments/bch-direct.md).

#### `ANCHOR_REQUEST_PRICE_USD`
- **Description**: Default USD price for a public transcript-anchor request (also used by NOWPayments)
- **Required**: No
- **Default**: `1`

#### `BCH_NETWORK`
- **Default**: `chipnet` when `ENVIRONMENT` ≠ `PRODUCTION` (local Docker); `mainnet` in production
- **Values**: `chipnet` (test net, like BTC signet), `mainnet`
- Chipnet verification uses Fulcrum/Electrum (`ssl://chipnet.bch.ninja:50002` by default)
- Mainnet verification uses Blockchair

#### `BCH_RECEIVE_ADDRESS` / `BCH_RECEIVE_ADDRESS_CHIPNET` / `BCH_RECEIVE_ADDRESS_MAINNET`
- **Required** (one of them for the active network) to enable the BCH method in the checkout chooser
- Chipnet: CashAddr `bchtest:q...`
- Mainnet: CashAddr `bitcoincash:q...`

#### `BCH_API_BASE` / `BCH_PAYMENT_TTL_MINUTES` / `BCH_MIN_CONFIRMATIONS` / `BCH_USD_PRICE`
- **Defaults**: follow `BCH_NETWORK` (Electrum SSL on chipnet, Blockchair on mainnet) / `30` / `0` / `0`
- `BCH_PAYMENT_TTL_MINUTES` is clamped to a **minimum of 5** minutes in code
- `BCH_USD_PRICE=0` fetches live USD/BCH from Blockchair mainnet `/stats` (also used to size chipnet orders)

### AWS Configuration (Production)

#### `AWS_ACCESS_KEY_ID`
- **Description**: AWS access key ID for S3 access
- **Required**: No (required for S3 media storage)
- **Example**: `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE`

#### `AWS_SECRET_ACCESS_KEY`
- **Description**: AWS secret access key for S3 access
- **Required**: No (required for S3 media storage)
- **Example**: `AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`

#### `AWS_STORAGE_BUCKET_NAME`
- **Description**: S3 bucket name for media files
- **Required**: No (if using S3)
- **Default**: `academiablockchain`
- **Example**: `AWS_STORAGE_BUCKET_NAME=my-bucket-name`

#### `AWS_S3_REGION_NAME`
- **Description**: AWS region for S3 bucket
- **Required**: No (if using S3)
- **Default**: `us-west-2`
- **Example**: `AWS_S3_REGION_NAME=us-east-1`

### Database backups (`scripts/backup-db.sh`)

Uses the same AWS credentials as media storage. Upload is automatic when `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_STORAGE_BUCKET_NAME` are set.

#### `BACKUP_S3_PREFIX`
- **Description**: S3 key prefix for database dumps
- **Default**: `db-backups`
- **Example**: `BACKUP_S3_PREFIX=db-backups`

#### `BACKUP_S3_UPLOAD`
- **Description**: Control S3 upload (`auto` uploads when AWS creds exist)
- **Default**: `auto`
- **Example**: `BACKUP_S3_UPLOAD=false`

#### `BACKUP_RETENTION_DAYS` / `BACKUP_S3_RETENTION_DAYS`
- **Description**: Days to keep local / S3 backups
- **Default**: `7`
- **Example**: `BACKUP_S3_RETENTION_DAYS=30`

### Email (Optional – SMTP2GO)

#### `SEND_EMAILS`
- **Description**: Enable sending of emails (password reset, confirmations, suggestions to admins, book club invites). When `false` or unset, no emails are sent (dummy backend).
- **Required**: No
- **Default**: `false`
- **Example**: `SEND_EMAILS=true`
- **Note**: Keep `false` until the sending domain is verified in SMTP2GO; see [Email features](email-features.md).

#### `EMAIL_HOST`
- **Description**: SMTP server hostname.
- **Required**: Yes if `SEND_EMAILS=true` in production
- **Default**: `mail.smtp2go.com`
- **Example**: `EMAIL_HOST=mail.smtp2go.com`

#### `EMAIL_PORT`
- **Description**: SMTP port (SMTP2GO default `2525`; alternatives include `587` with TLS).
- **Required**: No
- **Default**: `2525`
- **Example**: `EMAIL_PORT=2525`

#### `EMAIL_HOST_USER`
- **Description**: SMTP username from SMTP2GO → Sending → SMTP Users.
- **Required**: Yes if `SEND_EMAILS=true` in production
- **Example**: `EMAIL_HOST_USER=academiablockchain.com`

#### `EMAIL_HOST_PASSWORD`
- **Description**: SMTP password for the SMTP User.
- **Required**: Yes if `SEND_EMAILS=true` in production
- **Example**: `EMAIL_HOST_PASSWORD=your-smtp-password`

#### `EMAIL_USE_TLS`
- **Description**: Use STARTTLS (recommended for ports `2525` / `587`).
- **Required**: No
- **Default**: `true`
- **Example**: `EMAIL_USE_TLS=true`

#### `EMAIL_FROM` / `EMAIL_FROM_NAME`
- **Description**: Default From address and display name. Address must be on a verified SMTP2GO domain.
- **Required**: No
- **Defaults**: `noreply@academiablockchain.com` / `Academia Blockchain`

#### `FRONTEND_PUBLIC_URL` / `ACADEMIA_PUBLIC_URL`
- **Description**: Public site URLs used in email branding. Logo images use `{FRONTEND_PUBLIC_URL}/images/logo.png`. Django admin links in emails use `ACADEMIA_PUBLIC_URL`.
- **Required**: Recommended in production when `SEND_EMAILS=true`
- **Example**: `FRONTEND_PUBLIC_URL=https://www.academiablockchain.com`
### Monitoring (Optional)

#### `SENTRY_DSN`
- **Description**: Sentry DSN for error tracking
- **Required**: No
- **Example**: `SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/123456`

## Frontend Environment Variables

Location: `frontend/.env`

### Required Variables

#### `VITE_API_URL`
- **Description**: Backend API base URL
- **Required**: Yes
- **Development**: `http://localhost:8000/api`
- **Production**: `https://sophia-ai-api.algobeat.com/api`
- **Example**: `VITE_API_URL=http://localhost:8000/api`

### Google OAuth (Optional)

#### `VITE_GOOGLE_OAUTH_CLIENT_ID`
- **Description**: Google OAuth 2.0 Client ID for frontend
- **Required**: No (required for Google OAuth login)
- **Example**: `VITE_GOOGLE_OAUTH_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com`
- **Note**: Should match the backend `GOOGLE_OAUTH_CLIENT_ID` or use a separate web client ID

#### `VITE_GA_MEASUREMENT_ID`
- **Description**: Google Analytics 4 Measurement ID (`G-XXXXXXXX`)
- **Required**: No (analytics only loads when set)
- **Example**: `VITE_GA_MEASUREMENT_ID=G-PMB87DKKP6`
- **Note**: Injected at Vite build time. Set as a GitHub Repository variable for production image builds.

#### `VITE_META_PIXEL_ID`
- **Description**: Meta (Facebook) Pixel ID
- **Required**: No (pixel only loads when set)
- **Example**: `VITE_META_PIXEL_ID=123456789012345`
- **Note**: Injected at Vite build time. Set as a GitHub Repository variable for production image builds.

#### `VITE_SENTRY_DSN`
- **Description**: Sentry DSN for frontend error tracking
- **Required**: No
- **Example**: `VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx`

## Environment File Examples

### Backend Development (.env)

```env
ACADEMIA_BLOCKCHAIN_SKEY=django-insecure-development-key-123
ENVIRONMENT=DEVELOPMENT
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

# Database (usually handled by docker-compose)
DB_NAME=acbc_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=postgres

# Google OAuth (optional)
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_SECRET_KEY=your-secret-key
```

### Backend Production (.env)

```env
ACADEMIA_BLOCKCHAIN_SKEY=<generate-secure-key>
ENVIRONMENT=PRODUCTION
DEBUG=False
ALLOWED_HOSTS=example.com,www.example.com

# Database
DB_NAME=academiablockchain_prod
DB_USER=db_user
DB_PASSWORD=<secure-password>
DB_HOST=db.example.com
DB_PORT=5432

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_SECRET_KEY=your-secret-key

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_STORAGE_BUCKET_NAME=academiablockchain
AWS_S3_REGION_NAME=us-west-2

# Monitoring
SENTRY_DSN=your-sentry-dsn
```

### Frontend Development (.env)

```env
VITE_API_URL=http://localhost:8000/api
VITE_GOOGLE_OAUTH_CLIENT_ID=your-client-id
# Optional – leave unset locally to avoid polluting production analytics
# VITE_GA_MEASUREMENT_ID=G-PMB87DKKP6
# VITE_META_PIXEL_ID=your-meta-pixel-id
```

### Frontend Production (.env)

```env
VITE_API_URL=https://sophia-ai-api.algobeat.com/api
VITE_GOOGLE_OAUTH_CLIENT_ID=your-client-id
VITE_GA_MEASUREMENT_ID=G-PMB87DKKP6
VITE_META_PIXEL_ID=your-meta-pixel-id
```

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong secret keys** in production
3. **Rotate credentials** regularly
4. **Use different credentials** for development and production
5. **Restrict AWS IAM permissions** to minimum required
6. **Use environment-specific OAuth clients** when possible

## Docker Compose Environment

Some variables are set directly in `docker-compose.yml`:

```yaml
environment:
  - DB_NAME=acbc_db
  - DB_USER=postgres
  - DB_PASSWORD=postgres
  - DB_HOST=postgres
  - DEBUG=True
  - SECRET_KEY=django-insecure-development-key-123
```

These can be overridden by `.env` file values.

## Related Documentation

- [Local Development Setup](local-development.md)
- [Production Deployment](production.md)
- [Docker Configuration](docker.md)

