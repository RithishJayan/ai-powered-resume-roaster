# Evaluation suite (SER 594)

## How to run

From the **monorepo root**:

```bash
npm run eval
```

This runs deterministic checks on bundled fixtures (no API keys, no database). Exit code **0** means checks passed.

## Planned quantitative metrics (M4)

Report at least **two** metrics with a **baseline comparison** (course spec):

1. **Retrieval quality** — Precision@K or MRR on a curated query set over `rag_chunks` (compare chunking or embedding settings). Baseline: random chunks or no retrieval (`RAG_DISABLE=true` on the roast path).
2. **Generation / structure** — Share of model outputs where `[RESUME_SCORES]` and `[AI_ASSESSMENT]` blocks parse as valid JSON after a fixed prompt set; optional ROUGE or rubric scores against reference roasts.

Scripts for live metrics (calling Postgres + embedding APIs) can be added here as `eval/metrics-*.mjs` or `tsx` scripts; keep secrets out of the repo and document required env vars.

## Baselines

- **No RAG:** set `RAG_DISABLE=true` (or `RAG_DISABLED=true`) in backend env and compare roast relevance or structured-parse rates vs default.
- **Zero-shot vs few-shot:** toggle few-shot chunk inclusion in experiments (document in final report).
