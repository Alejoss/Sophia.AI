# AGENTS.md

## Cursor Cloud specific instructions

This repo is a monorepo with three components:

- **Backend** (`acbc_app/`): Django 5 REST API. Runs on `http://localhost:8000` (dev: `python manage.py runserver`; see `entrypoint.sh`). Swagger at `/swagger/`, admin at `/admin/`.
- **Frontend** (`frontend/`): React 18 + Vite. Dev server on `http://localhost:5173` (`npm run dev`). Vite proxies `/api`, `/admin`, `/media` to `:8000` (see `vite.config.js`).
- **Contracts** (`contracts/`): Solidity + Hardhat. Secondary/optional component.

The dependency-refresh update script (Python venv + `pip install`, `npm install` for `frontend` and `contracts`) runs automatically on VM startup. The notes below are the non-obvious things it does NOT handle.

### Backend (Django) — how to run

Settings live in `acbc_app/academia_blockchain/settings.py`. **`settings.py` does NOT load a `.env` file for native (non-Docker) runs** — you must export env vars in the shell. The Python venv is at `acbc_app/.venv`.

```bash
cd acbc_app && . .venv/bin/activate
export ENVIRONMENT=DEVELOPMENT DB_NAME=acbc_db POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres DB_HOST=localhost DB_PORT=5432
python manage.py runserver 0.0.0.0:8000
```

- **PostgreSQL is installed natively (not Docker) and must be started manually** if not already running: `sudo pg_ctlcluster 16 main start`. Dev DB is `acbc_db`, user/password `postgres`/`postgres` on `localhost:5432`.
- Superuser seeded by `python manage.py create_admin` is **`admin` / `admin`**.
- Seed data commands (run in order, see `acbc_app/README.md`): `populate_cryptocurrencies`, `populate_users`, `populate_content`, `populate_knowledge_paths`, `populate_interactions`, `populate_book_club`.

### Backend tests

Tests **automatically switch to in-memory SQLite** (see the `"test" in sys.argv` check in `settings.py`), so PostgreSQL is NOT required to run them:

```bash
cd acbc_app && . .venv/bin/activate && ENVIRONMENT=DEVELOPMENT python manage.py test profiles tests -v 1
```

### Frontend (Vite) — required env var gotcha

**The app crashes to a blank "Algo salió mal" error page if `VITE_GOOGLE_OAUTH_CLIENT_ID` is unset** (`GoogleOAuthInitializer` throws). `frontend/.env` is gitignored, so if it is missing recreate it with:

```
VITE_API_URL=http://localhost:8000/api
VITE_GOOGLE_OAUTH_CLIENT_ID=placeholder-for-testing
```

A placeholder value is fine for local dev (real Google login won't work, but username/password auth and everything else does). Start the backend before the frontend so API calls don't hit `ERR_CONNECTION_REFUSED`.

### Frontend lint/test — pre-existing failures

`npm run lint` (ESLint) and `npm run test` (Vitest) both currently report **pre-existing failures in the repo** (unused-var lint errors; a few Vitest assertions on Spanish UI text). These are code issues, not environment problems — the tooling itself works.

### Contracts (Hardhat) — optional / secondary

Transcript certification is **Bitcoin OP_RETURN** (Django `content.bitcoin` + `broadcast_transcript_anchor`), not an EVM registry. See `docs/api/transcript-anchor.md`.

`npx hardhat compile` may still fail if a draft Chainlink file under `contracts/` uses the deprecated Client API (`buildChainlinkRequest`/`sendChainlinkRequestTo`). Prefer drafts in `contracts/drafts/`. `contracts/test/` is empty (`.gitkeep` only).

### Topic RAG / embeddings (optional)

Topic conversation chat uses **Qdrant** (transcript chunk vectors) and **OpenAI** (query embedding + grounded answers). Vectors are **not** in Postgres; an external embed worker acks via `/api/content/embedding-ingest/`.

- Docs: [topic-rag-embeddings.md](docs/architecture/topic-rag-embeddings.md), [qdrant-embeddings.md](docs/operations/qdrant-embeddings.md)
- Backend env (export in shell for native runs, or `acbc_app/.env` for Docker):

```bash
export OPENAI_API_KEY=sk-…
export QDRANT_URL=https://….cloud.qdrant.io
export QDRANT_API_KEY=…
export QDRANT_COLLECTION=sophia_acbc_topic_chunks
export TRANSCRIPT_INGEST_API_KEY=dev-ingest-secret   # for embed-worker API in dev
```

- Verify Qdrant: `cd acbc_app && . .venv/bin/activate && python manage.py check_qdrant --ensure-collection`
- **Seed data** (`populate_content`) sets `embedding_status=skipped`, so Conversación will not appear until transcripts are acked as `indexed` (manually in dev or via the embed worker).
- Topic chat tests mock OpenAI/Qdrant; no live keys required for `python manage.py test content.tests.TopicChatAPITests`.
