# Manual QA checklist

Run **`npm run dev`** from the repo root with Postgres up (`docker compose up -d`), migrations applied (`npm run db:migrate`), and RAG corpus ingested (`npm run rag:ingest`) per the main [README](README.md).

1. **Register** — Open `/register`, create a new user with a valid email and password (8+ characters). Expect success or a clear duplicate-email message.
2. **Login** — Open `/login`, sign in with the same credentials. Expect redirect to `/`.
3. **Protected home** — While signed out, visiting `/` should redirect to `/login`.
4. **Roast** — On `/`, upload a small PDF or DOCX resume, optionally set job text and directions, choose a provider with keys configured in `backend/.env`, submit. Expect roast text (and optional score blocks when the model follows the format).
5. **Feedback** — After a successful roast, submit thumbs/comment if the UI exposes feedback. Expect confirmation or a clear error if `roastLogId` is missing.

## Final smoke test: latency + error rate (p50/p95)

This repo includes an automated smoke runner that times the core workflows against the **backend API** (client-side wall time / end-to-end HTTP).

### Prereqs

- Start the stack (from repo root):
  - `docker compose up -d`
  - `npm run db:migrate`
  - (for RAG-on measurements) `npm run rag:ingest`
  - `npm run dev` (frontend + backend)
- Ensure a provider key is configured for `POST /api/roast` (e.g. `GROQ_API_KEY` in `backend/.env` or repo-root `.env`).

### Run (RAG enabled)

From the repo root (backend must be reachable at `http://127.0.0.1:4000`):

```bash
node eval/latency-smoke.mjs
```

Optional environment variables:

```bash
BACKEND_BASE_URL="http://127.0.0.1:4000" \
SMOKE_SAMPLES=50 \
SMOKE_WARMUP=2 \
SMOKE_CONCURRENCY=1 \
SMOKE_PROVIDER=groq \
SMOKE_MODEL="llama-3.1-8b-instant" \
SMOKE_ROAST_LEVEL=low \
SMOKE_ROAST_DELAY_MS=2500 \
node eval/latency-smoke.mjs
```

### Run (RAG disabled / “no RAG” baseline)

Restart the backend with RAG disabled, then re-run the same command above:

```bash
RAG_DISABLE=true npm run dev -w backend
node eval/latency-smoke.mjs
```

### Record results

Copy the “Pasteable report lines” block printed by the script into the final report section, e.g.:

```text
Roast generation p50 latency: <value> seconds
Roast generation p95 latency: <value> seconds
Feedback submission p50 latency: <value> ms
```

Error rate is printed as:

```text
error rate = failed requests / total requests
```

## Test coverage (local + CI)

- **Local**: run `npm test -- --coverage` from the repo root. This prints a coverage summary and generates an HTML report under `backend/coverage/`.
- **CI**: the GitHub Actions workflow uploads a `backend-coverage` artifact. Download it and open `backend/coverage/index.html`.

For architecture and RAG flow details, see [`backend/docs/milestone2-architecture.md`](backend/docs/milestone2-architecture.md).
