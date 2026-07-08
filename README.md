# AI Resume Roaster (SER594)

This folder is a **standalone monorepo**: **`frontend/`** (Next.js UI + NextAuth + middleware) and **`backend/`** (Hono HTTP API for register, roast, feedback, internal auth verify, plus `lib/`, `db/`, RAG ingest). It omits `training/`, `AI-roaster/`, `/api/roast/export`, and `/api/send-email`.

The browser only talks to **`http://localhost:3009`**. Next.js **rewrites** proxy `/api/register`, `/api/roast`, and `/api/roast/feedback` to the backend (default **`http://127.0.0.1:4000`**) so NextAuth cookies stay same-origin.

**Milestone 4 final submission note:** this repository is the final project monorepo for SER 594 Team 7. It includes setup, build, run, Docker deployment, architecture, AI techniques, evaluation methodology, system evaluation, testing notes, and design decisions for grading.

## Project description

**AI Resume Roaster** lets users **register and log in**, upload a **resume (PDF/DOCX)**, and receive an **AI-generated roast**. The backend can optionally use **RAG** (pgvector) to retrieve relevant writing guidance / examples, and computes a **lexical TF–IDF job-fit** score when a sufficiently long job description is provided. Users can also submit **feedback** (thumbs/comment) that is stored in Postgres.

The system is designed for **job seekers, students, early-career candidates, and career switchers** who want targeted resume feedback for a specific job description. It goes beyond a single LLM API call by combining authentication, persistent storage, resume ingestion, RAG retrieval, structured output parsing, TF-IDF scoring, moderation/safety handling, logging, feedback persistence, tests, and evaluation scripts.

## Team

| Name                             | GitHub       | Role / responsibilities |
| -------------------------------- | ------------ | ----------------------- |
| Nidhi Vispute (1239551069)       | nvisputech   | Backend/Frontend        |
| Anshul Kumar Sharma (1237731380) | akshar18     | Backend/Frontend        |
| Rahaf Almakhalas (1237461461)    | Rahafm11     | Backend/Frontend        |
| Rithish Jayan (1234739287)       | RithishJayan | Backend/Frontend        |

## Prerequisites

- **Node.js** 20+ (LTS recommended) and **npm**
- **Docker** with Compose, for Postgres + pgvector — use [`docker-compose.yml`](docker-compose.yml) at this monorepo root (`docker compose up -d`)
- **API keys** (see [`.env.example`](.env.example)): at least one chat provider (`GROQ_API_KEY` and/or `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`); for RAG ingest and live retrieval, **Nomic** and/or **OpenAI** embedding keys as documented there

## Layout

| Package                  | Role                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`frontend/`](frontend/) | Next.js 14: `app/` pages, `middleware.ts`, `app/api/auth/[...nextauth]`, [`next.config.js` rewrites](frontend/next.config.js) to the backend                 |
| [`backend/`](backend/)   | Hono server on `PORT` (default **4000**), Drizzle + migrations, [`rag/corpus/`](backend/rag/corpus/), [`docs/`](backend/docs/), `npm run rag:ingest`, Vitest |
| [`eval/`](eval/)         | Deterministic evaluation checks, baseline comparison notes, and final metric documentation                                                                    |
| [`tests/`](tests/)       | Root-level testing notes that map the required course test structure to the workspace layout                                                                  |
| [`.github/workflows/`](.github/workflows/) | CI configuration for automated checks                                                                                                          |

## Architecture

High-level system context (browser → Next.js → Hono → Postgres + external LLM/embeddings). For auth/RAG sequence diagrams and PDF export instructions, see [`backend/docs/milestone2-architecture.md`](backend/docs/milestone2-architecture.md).

```mermaid
flowchart TB
  subgraph browser [Browser]
    UI[Login_Register_RoastUI]
  end
  subgraph fe [frontend_Nextjs]
    MW[middleware_JWT]
    NA[NextAuth_api_auth]
    RW[rewrites_to_backend]
  end
  subgraph be [backend_Hono]
    API[register_roast_feedback]
    LIB[lib_rag_roast]
  end
  subgraph pg [Postgres_pgvector]
    U[users]
    RC[rag_chunks]
    RL[roast_logs]
    RF[roast_feedback]
  end
  subgraph ext [External_APIs]
    LLM[LLM_providers]
    EMB[Nomic_or_OpenAI_embeddings]
    MOD[OpenAI_moderation]
  end
  UI --> MW
  UI --> NA
  UI --> RW
  RW --> API
  API --> LIB
  API --> U
  API --> RC
  API --> RL
  API --> RF
  API --> LLM
  API --> EMB
  API --> MOD
```

## Environment files (important)

### Where env values come from (this is what the grader cares about)

- **Frontend (Next.js / NextAuth)** reads **`frontend/.env.local`** (and other Next env files in `frontend/`).
  **Important:** A repo-root `.env.local` is **not** automatically read by Next.
- **Backend (Hono / Drizzle)** reads **`backend/.env`** and **`backend/.env.local`**, and also optionally the repo-root **`.env`** / **`.env.local`** files (see [`backend/src/index.ts`](backend/src/index.ts)).
- **Docker Compose** uses a repo-root **`.env`** (next to `docker-compose.yml`) for **`${VAR}` substitution**, and `docker-compose.yml` also loads env into containers via `env_file`.

### How to set up `frontend/.env.local`

Create `frontend/.env.local` using [`frontend/.env.example`](frontend/.env.example).

Minimum required values:

```bash
NEXTAUTH_URL=http://localhost:3009
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
BACKEND_URL=http://127.0.0.1:4000
INTERNAL_AUTH_SECRET=<optional; if set, use same value in backend/.env>
```

### How to set up `backend/.env`

Create `backend/.env` using [`backend/.env.example`](backend/.env.example).

Minimum required values:

- `DATABASE_URL=postgresql://resume_roast:resume_roast@127.0.0.1:5434/resume_roast` (default when running Postgres via Compose DB-only)
- `NEXTAUTH_SECRET=<must be the SAME value as frontend/.env.local>`
- At least one LLM provider key (for free testing, Groq: `GROQ_API_KEY` from `https://console.groq.com/keys`)

### Critical rule (auth breaks if wrong)

**`NEXTAUTH_SECRET` must be identical in `frontend/.env.local` and `backend/.env`.**
If you change it, clear cookies for `localhost` (or use an incognito window) to avoid NextAuth JWT decryption errors.

### Optional: repo-root `.env` (Docker Compose)

If you run `docker compose up --build` (full stack), put overrides in repo-root `.env` (next to `docker-compose.yml`), for example:

```bash
NEXTAUTH_SECRET=<same secret used everywhere>
GROQ_API_KEY=...
```

## Development Environment Setup

Follow **Quick start** below from this repository’s root (for example `SER594-Team7-AIResumeRoaster/` when cloned with the default folder name).

## Quick start (from `SER594-Team7-AIResumeRoaster/`)

1. **Environment** — Create **`frontend/.env.local`** and **`backend/.env`** if needed, then add secrets. At minimum **frontend**: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `BACKEND_URL`; **backend**: `DATABASE_URL`, `NEXTAUTH_SECRET` (match frontend), LLM/embedding keys. Optionally set **`INTERNAL_AUTH_SECRET`** to the same value in **both** files. For the **Custom** LLM option in the UI, set `CUSTOM_LLM_BASE_URL`, `CUSTOM_LLM_MODEL`, and `CUSTOM_LLM_API_KEY` in **`backend/.env`** only. `npm run dev` in the frontend workspace also loads **`../.env.local`** first if you prefer keeping one shared file at the monorepo root (later `frontend/.env.local` overrides).
2. `docker compose up -d` (compose file lives at the **monorepo root**, next to this README). Postgres is published on host port **5434** by default (see [`docker-compose.yml`](docker-compose.yml)); set `DATABASE_URL` to use port **5434**, or set `POSTGRES_PUBLISH_PORT` if you change the mapping.
3. `npm install` (workspace root installs `frontend` + `backend`)
4. `npm run db:migrate` and `npm run rag:ingest`
5. `npm run dev` — starts backend and frontend (**`concurrently`**). Open `/register`, `/login`, `/` to roast. If Next logs **`EMFILE: too many open files`**, raise your OS file descriptor limit or run with polling: `WATCHPACK_POLLING=true npm run dev`.

**Other commands:** `npm run test` (backend Vitest), `npm run build` (frontend production build). Manual QA and architecture notes: [`backend/docs/milestone2-architecture.md`](backend/docs/milestone2-architecture.md).

## How to run backend

From repo root:

```bash
npm run dev -w backend
```

## How to run frontend

From repo root:

```bash
npm run dev -w frontend
```

## Authentication / login

1. Open **`/register`** to create an account.
2. Open **`/login`** to sign in (NextAuth credentials).
3. Visit **`/`** to use the app (protected by `frontend/middleware.ts`).

## How to use each feature

- **Roast**: On **`/`**, optionally enter job description + custom directions, pick provider + roast level, upload PDF/DOCX, submit.
- **RAG**: Run `npm run rag:ingest` once after DB migrate and embedding keys; set `RAG_DISABLE=true` to disable retrieval.
- **TF–IDF job fit**: Shown when job description is long enough; measures lexical overlap (not semantic match).
- **Feedback**: Thumbs/comment stored in Postgres when `roastLogId` is present.

## AI techniques and integration

### AI technique 1 — RAG + vector embeddings

The system uses Retrieval-Augmented Generation to make resume feedback more grounded and less generic.

How it works:

1. Resume-writing guidance and examples are stored in the RAG corpus.
2. The corpus is chunked into smaller passages.
3. Chunks are embedded using Nomic or OpenAI embeddings.
4. Embeddings are stored in Postgres using pgvector.
5. During resume analysis, the backend builds a query from the resume and job description.
6. Similar chunks are retrieved from `rag_chunks`.
7. Retrieved guidance is inserted into the LLM prompt before generation.

Relevant command:

```bash
npm run rag:ingest
```

### AI technique 2 — Prompt engineering + structured outputs

The roast prompt requires the model to return both readable critique and machine-readable score blocks.

Expected model output includes:

```text
[Level: Medium]

... resume feedback ...

[RESUME_SCORES]
{"overall":72,"breakdown":{"impact":70,"clarity":75,"relevance":68}}
[/RESUME_SCORES]

[AI_ASSESSMENT]
{"score":45,"label":"Possibly AI-assisted","signs":{"generic_bullets":true}}
[/AI_ASSESSMENT]
```

How it is integrated:

- The backend constructs prompts with resume text, job description, RAG context, roast level, and formatting rules.
- The parser extracts `[RESUME_SCORES]` and `[AI_ASSESSMENT]`.
- Scores are validated and clamped to safe ranges.
- Malformed blocks are handled gracefully instead of crashing the UI.
- The frontend uses parsed blocks to show scores, assessment labels, and highlighted feedback.

### AI technique 3 — LLM orchestration and provider abstraction

The backend supports multiple chat providers through a provider-agnostic workflow.

Supported provider paths include:

- Groq
- OpenAI
- Anthropic
- Custom OpenAI-compatible provider configuration

How it is integrated:

1. The user selects a provider and roast level in the UI.
2. The backend maps the request to the selected provider.
3. The provider returns generated feedback.
4. The backend parses the structured output.
5. Moderation/safety logic can run when configured.
6. The system persists the roast log and returns the final response to the frontend.

### AI technique 4 — TF-IDF job-fit scoring

When a sufficiently long job description is provided, the backend computes a lexical TF-IDF job-fit score.

How it is integrated:

- Resume text and job description are preprocessed.
- TF-IDF terms are compared.
- The system estimates lexical overlap between the resume and job requirements.
- The score is returned with the roast output.
- This gives the user a deterministic signal in addition to the LLM-generated critique.

## Testing

From the monorepo root, run **`npm test`** (same as `npm run test -w backend`). The Vitest suite lives under [`backend/__tests__/`](backend/__tests__/) and covers prompt/RAG helpers, embedding provider resolution, and structured output parsing. The course suggests a `tests/` path at repo root; see [`tests/README.md`](tests/README.md) for how that maps to this layout.

For a manual smoke checklist (register → login → roast → feedback), see [`TESTING.md`](TESTING.md).

Test coverage areas include:

- API helper logic
- Prompt/RAG helpers
- Embedding provider resolution
- Structured output parsing
- TF-IDF job-fit logic
- Manual authentication flow
- Manual roast and feedback flow

## Evaluation

Run the bundled deterministic checks (no API keys):

```bash
npm run eval
```

Planned quantitative metrics and baselines for the final report are documented in [`eval/README.md`](eval/README.md).

### Evaluation methodology

The final evaluation focuses on whether the AI output is reliable enough for the application to parse, display, and evaluate.

| Metric | Purpose | Baseline | Current system |
| ------ | ------- | -------- | -------------- |
| Structured output parse rate | Measures whether required JSON blocks can be parsed | Unstructured LLM output with no required tags | Structured fixture with `[RESUME_SCORES]` and `[AI_ASSESSMENT]` |
| Roast level tag presence | Measures whether the output includes the required `[Level: ...]` marker | Unstructured output sample | Structured prompted output |
| Retrieval quality | Planned metric for whether retrieved RAG chunks are relevant | Random chunks or `RAG_DISABLE=true` | pgvector similarity retrieval |
| Job-fit scoring consistency | Planned metric for role-fit comparison | No job description baseline | TF-IDF lexical overlap score |

### Current evaluation results

Current deterministic eval command:

```bash
npm run eval
```

Expected result:

```text
fixture_block_parse_rate: 1.0000
level_tag_present: 1.0000
```

Summary:

| Metric | Baseline | Current result |
| ------ | -------- | -------------- |
| Structured output parse rate | 0% | 100% |
| Roast level tag presence | 0% | 100% |

The baseline is an unstructured output sample that does not include the required machine-readable score blocks. The current system uses prompt engineering and structured parsing, so the deterministic fixture successfully validates both required JSON blocks.

Final evaluation files should be kept in:

```text
eval/
├── README.md
├── run.mjs
└── results.md
```

Detailed evaluation results are documented in `eval/results.md`.

## System evaluation

System-level quality is evaluated separately from AI output quality.

### Response latency

Measure latency during final smoke testing for the main workflows.

| Action | Measurement method | Result |
| ------ | ------------------ | ------ |
| Register user | Manual/API timing | Record during final smoke test |
| Login user | Manual/API timing | Record during final smoke test |
| Generate roast with RAG | Backend/API timing | Record during final smoke test |
| Generate roast without RAG | Backend/API timing | Record during final smoke test |
| Submit feedback | Manual/API timing | Record during final smoke test |

Measured smoke-test results:

```text
Register user
samples: 50 (success: 50, failed: 0)
error rate: 0.0000
p50 latency: 258 ms
p95 latency: 268 ms

Login user
samples: 50 (success: 50, failed: 0)
error rate: 0.0000
p50 latency: 288 ms
p95 latency: 302 ms

Feedback submission
samples: 50 (success: 50, failed: 0)
error rate: 0.0000
p50 latency: 3 ms
p95 latency: 7 ms
```

### Error rate

```text
Roast generation
samples: 50 (success: 45, failed: 5)
error rate: 5/50 = 10.00%
p50 latency: 19.158 seconds
p95 latency: 33.441 seconds
```


### Test coverage

|Test Files  5 passed (5)
      Tests  27 passed (27)
   Start at  00:52:18
   Duration  438ms (transform 85ms, setup 0ms, collect 179ms, tests 12ms, environment 1ms, prepare 320ms)

 % Coverage report from v8
--------------------|---------|----------|---------|---------|-------------------
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
--------------------|---------|----------|---------|---------|-------------------
All files           |   16.12 |       75 |   32.14 |   16.12 |                   
 backend            |       0 |        0 |       0 |       0 |                   
  drizzle.config.ts |       0 |        0 |       0 |       0 | 1-22              
 backend/db         |       0 |        0 |       0 |       0 |                   
  index.ts          |       0 |        0 |       0 |       0 | 1-50              
  schema.ts         |       0 |        0 |       0 |       0 | 1-103             
 backend/lib/rag    |   13.69 |    77.77 |      25 |   13.69 |                   
  embed.ts          |   25.97 |    82.35 |   33.33 |   25.97 | 33-34,40-97       
  retrieve.ts       |       0 |        0 |       0 |       0 | 1-69              
 backend/lib/roast  |   58.38 |    89.09 |   61.53 |   58.38 |                   
  logging.ts        |       0 |        0 |       0 |       0 | 1-58              
  moderation.ts     |       0 |        0 |       0 |       0 | 1-64              
  parseOutput.ts    |   98.03 |    94.44 |     100 |   98.03 | 33                
  prompts.ts        |   60.37 |      100 |      40 |   60.37 | 61-63,66-77,86-96 
  tfidfJobFit.ts    |     100 |    90.32 |     100 |     100 | 125,140,149       
 backend/scripts    |       0 |        0 |       0 |       0 |                   
  rag-ingest.ts     |       0 |        0 |       0 |       0 | 1-109             
  run-tsx.mjs       |       0 |        0 |       0 |       0 | 1-31              
 backend/src        |       0 |        0 |       0 |       0 |                   
  app.ts            |       0 |        0 |       0 |       0 | 1-12              
  index.ts          |       0 |        0 |       0 |       0 | 1-18              
 backend/src/routes |       0 |        0 |       0 |       0 |                   
  feedback.ts       |       0 |        0 |       0 |       0 | 1-52              
  internal.ts       |       0 |        0 |       0 |       0 | 1-48              
  register.ts       |       0 |        0 |       0 |       0 | 1-60              
  roast.ts          |       0 |        0 |       0 |       0 | 1-380             
--------------------|---------|----------|---------|---------|-------------------

## Deployment

**Public deployment:**

```text
**Public deployment:** https://roast.invoiceforge.online/

The deployed system will remain accessible during the grading period.
```

## Local production build and run

1. **Build** — From `SER594-Team7-AIResumeRoaster/` (this repository’s root), run `npm run build`. This builds the **frontend** Next app only ([`package.json`](package.json) `build` script). Set **`BACKEND_URL`** in the environment (or `frontend/.env.production.local`) **before** `npm run build` if the API is not at `http://127.0.0.1:4000`, because [`frontend/next.config.js`](frontend/next.config.js) bakes rewrite destinations from `process.env.BACKEND_URL` at build time.
2. **Run two processes** — Production requires both packages:
   - **Backend:** `npm run start -w backend` (runs `tsx src/index.ts` — see [`backend/package.json`](backend/package.json)). Ensure `backend/.env` (or root `.env`) has `DATABASE_URL`, `NEXTAUTH_SECRET`, `PORT` if not 4000, and LLM/embedding keys.
   - **Frontend:** `npm run start -w frontend` (or `npm start` from the monorepo root, which currently starts **frontend only**). Serve on port **3009** by default. Frontend env must include the **same** `NEXTAUTH_SECRET` as the backend and a `BACKEND_URL` that points at the running API (for rewrites).

Without the backend process, register/roast/feedback requests proxied from Next will fail.

## Authentication and AI technique #1 (RAG-augmented roast)

**Authentication**

1. Open **`/register`**, create an account (POST goes to the backend via Next rewrite).
2. Open **`/login`** and sign in with NextAuth (credentials). The home page **`/`** is protected by [`frontend/middleware.ts`](frontend/middleware.ts); unauthenticated users are redirected to login.

**AI technique #1 — end-to-end RAG roast**

After you are signed in, on **`/`**:

1. Optionally enter a **target job/role** and **custom directions**.
2. Choose a **provider** (e.g. Groq) and **roast level**, then upload a **PDF or DOCX** (under 5 MB) and click **Roast my resume**.
3. The **backend** extracts text, **embeds** a query from job + resume context, **retrieves** similar rows from **`rag_chunks`** (pgvector) plus few-shot examples, **builds** the system/user prompts, calls the **LLM**, optionally runs **moderation** (when OpenAI key is present), **persists** a roast log when the database is configured, and returns the roast text plus score / AI-assessment blocks when the model follows the prompt format.

For step-by-step manual checks (including feedback), follow the flows described in [`backend/docs/milestone2-architecture.md`](backend/docs/milestone2-architecture.md).

## Architecture PDF

[`backend/docs/milestone2-architecture.md`](backend/docs/milestone2-architecture.md) — align with 768 / Nomic before export; backend tables match [`backend/db/schema.ts`](backend/db/schema.ts).

## Design decisions, trade-offs, and lessons learned

For a dedicated design document, see or create:

```text
docs/DESIGN.md
```

### Design decisions

1. **Full-stack workflow instead of chatbot wrapper**  
   The system includes authentication, resume ingestion, RAG retrieval, LLM orchestration, structured output parsing, persistence, feedback logging, and evaluation.

2. **PostgreSQL with pgvector**  
   PostgreSQL stores users, logs, feedback, and RAG chunks. pgvector supports semantic retrieval without requiring a separate vector database.

3. **Provider-agnostic LLM layer**  
   The backend can work with Groq, OpenAI, Anthropic, and custom OpenAI-compatible providers depending on configured keys.

4. **Structured output parsing**  
   The model returns both readable feedback and machine-readable score blocks. The parser validates JSON and handles malformed output gracefully.

5. **Privacy-aware logging**  
   Resume and job description text can be hashed, and full text storage is controlled by environment configuration.

### Trade-offs

- pgvector is easier to deploy than a dedicated vector database, but a specialized vector DB could offer more advanced retrieval features.
- Structured outputs improve UI reliability, but they require parser validation and fallback handling.
- Supporting multiple providers improves flexibility, but increases integration complexity.
- RAG improves grounding, but feedback quality depends on chunking, embedding quality, and retrieval relevance.

### Lessons learned

- RAG is only useful when the retrieval pipeline is designed carefully.
- LLM outputs must be validated before the frontend depends on them.
- Prompt engineering alone is not enough; production AI systems need preprocessing, parsing, persistence, error handling, and evaluation.
- Resume feedback should critique the document, not the person.
- Testing, logging, environment setup, and deployment instructions are essential for a gradable AI system.

## `.npmrc`

Monorepo root [`.npmrc`](.npmrc) uses `legacy-peer-deps=true` for workspace installs (NextAuth).
