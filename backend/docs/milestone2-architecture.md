# Resume Roast — Milestone 2 architecture

**For Canvas:** Export this document to PDF (e.g. open in VS Code / GitHub preview → **Print → Save as PDF**, or use a “Markdown PDF” extension, or from this folder run Pandoc `pandoc milestone2-architecture.md -o architecture.pdf`).

## Overview

SER594-M2 is a **monorepo**: **`frontend/`** is a **Next.js 14** app (UI, NextAuth, `middleware.ts`); **`backend/`** is a **Hono** HTTP server (register, roast, feedback, RAG ingest, Drizzle, `lib/`). The browser calls **`http://localhost:3009`** only; Next.js **rewrites** proxy `/api/register`, `/api/roast`, and `/api/roast/feedback` to the backend so session cookies stay same-origin. **PostgreSQL** with **pgvector** stores RAG chunks, users, roast logs, and feedback. **External HTTP APIs** provide LLM inference, embeddings, and moderation.

## Layers

| Layer                  | Components                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend (`frontend/`) | App Router: `/login`, `/register`, `/`; `SessionProvider`; `app/api/auth/*` (NextAuth); `middleware.ts` (JWT gate on `/`); rewrites to backend for roast/register/feedback            |
| Backend (`backend/`)   | Hono: `POST /api/register`, `POST /api/roast`, `POST /api/roast/feedback`, `POST /api/internal/verify-credentials`; `lib/`, `db/`, `drizzle/`, `rag/corpus/`, `scripts/rag-ingest.ts` |
| Data                   | Postgres: `users`, `rag_chunks` (+ vector index), `roast_logs`, `roast_feedback`                                                                                                      |
| External               | Groq / OpenAI / Anthropic (or custom OpenAI-compatible base URL); Nomic and/or OpenAI embeddings; OpenAI moderation when enabled                                                      |

## System context

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

## Auth data flow

```mermaid
sequenceDiagram
  participant User
  participant Next as frontend_Nextjs
  participant Be as backend_Hono
  participant DB as Postgres_users
  User->>Next: POST_register_JSON
  Next->>Be: rewrite_POST_api_register
  Be->>DB: insert_users_bcrypt_hash
  DB-->>Be: ok
  Be-->>User: 201_created
  User->>Next: POST_NextAuth_credentials
  Next->>Be: POST_internal_verify_credentials
  Be->>DB: select_user_by_email
  DB-->>Be: user_row
  Be-->>Next: user_json
  Next-->>User: Set_HTTP_only_JWT_session_cookie
```

## Roast and RAG pipeline (AI technique #1)

```mermaid
sequenceDiagram
  participant User
  participant Next as frontend_Nextjs
  participant Roast as backend_Hono_roast
  participant Emb as embeddings
  participant PG as Postgres_pgvector
  participant LLM as LLM_provider
  participant Mod as Moderation_optional
  User->>Next: POST_multipart_same_origin
  Next->>Roast: rewrite_with_Cookie_header
  Roast->>Roast: extract_PDF_or_DOCX_text
  Roast->>Emb: embed_query_job_plus_resume_prefix
  Emb-->>Roast: vector_768
  Roast->>PG: vector_search_plus_few_shots
  PG-->>Roast: rag_chunks
  Roast->>LLM: system_plus_user_prompt
  LLM-->>Roast: roast_text_and_score_blocks
  Roast->>Mod: moderate_output_if_OpenAI_key
  Mod-->>Roast: safe_or_retry
  Roast->>PG: insert_roast_logs_user_id_optional
  Roast-->>User: JSON_roast_roastLogId_scores
```

## External services and APIs

- **Groq** — OpenAI-compatible chat completions (`api.groq.com`).
- **OpenAI** — Chat completions; **text-embedding-3-small** for RAG query vectors; **Moderations** API for post-output safety when key present.
- **Anthropic** — Messages API for Claude models.
- **Custom** — Any OpenAI-compatible base URL (e.g. vLLM) via `CUSTOM_LLM_BASE_URL`.
- **Nomic Atlas** — Text embeddings (`NOMIC_API_KEY`) at 768 dimensions, aligned with `text-embedding-3-small` @ 768 in this app.

## Notes for graders

- **Vector store:** `rag_chunks.embedding` is `vector(768)` with an **HNSW** index (see `backend/drizzle/` migrations).
- **Ingestion:** From monorepo root, `npm run rag:ingest` runs in **backend** and reads `backend/rag/corpus/**` markdown, chunks, embeds, inserts rows.
- **Auth:** Email/password in `users`; sessions are **JWT** cookies via NextAuth on the **frontend**; home `/` requires a valid session (`frontend/middleware.ts`). Login checks credentials via **backend** internal route.
