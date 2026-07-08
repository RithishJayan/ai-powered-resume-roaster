#!/usr/bin/env node
/**
 * Latency + error-rate smoke runner (local dev).
 *
 * Measures:
 * - Register: POST /api/register
 * - Login (credential verify): POST /api/internal/verify-credentials
 * - Roast: POST /api/roast (multipart; uses eval/fixtures/sample_resume.pdf)
 * - Feedback: POST /api/roast/feedback (uses roastLogId from roast response)
 *
 * Notes:
 * - This measures client-side wall time (end-to-end HTTP).
 * - For “No RAG”, restart backend with RAG_DISABLE=true then re-run this script.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun } from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function envInt(name, def) {
  const raw = process.env[name];
  if (!raw) return def;
  const n = Number(raw);
  return Number.isFinite(n) ? n : def;
}

const BASE_URL = (process.env.BACKEND_BASE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
const SAMPLES = envInt('SMOKE_SAMPLES', 50);
const WARMUP = envInt('SMOKE_WARMUP', 2);
const CONCURRENCY = envInt('SMOKE_CONCURRENCY', 1);

const PROVIDER = (process.env.SMOKE_PROVIDER || 'groq').trim(); // groq | openai | anthropic | custom
const MODEL = (process.env.SMOKE_MODEL || '').trim();
const ROAST_LEVEL = (process.env.SMOKE_ROAST_LEVEL || 'medium').trim();
const REQUEST_TIMEOUT_MS = envInt('SMOKE_REQUEST_TIMEOUT_MS', 120000);
const PROGRESS_EVERY = envInt('SMOKE_PROGRESS_EVERY', 5);
const ROAST_DELAY_MS = envInt('SMOKE_ROAST_DELAY_MS', 0);
const ROAST_RETRY_MAX = envInt('SMOKE_ROAST_RETRY_MAX', 2);

const FIXTURE_PATH = process.env.SMOKE_FIXTURE_PATH ? path.resolve(process.env.SMOKE_FIXTURE_PATH) : null;

const JOB_DESCRIPTION =
  process.env.SMOKE_JOB_DESCRIPTION ||
  'Software Engineer role focused on TypeScript, web APIs, PostgreSQL, testing, and performance.';
const DIRECTIONS =
  process.env.SMOKE_DIRECTIONS || 'Be concise, specific, and give actionable improvements with measurable examples.';

const PASSWORD = process.env.SMOKE_PASSWORD || 'Password123!';

function nowMs() {
  return Date.now();
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function summarize(durationsMs, okFlags) {
  const samples = durationsMs.length;
  const failures = okFlags.filter((x) => !x).length;
  const successes = samples - failures;
  const sortedOk = durationsMs
    .map((ms, i) => ({ ms, ok: okFlags[i] }))
    .filter((x) => x.ok)
    .map((x) => x.ms)
    .sort((a, b) => a - b);

  return {
    samples,
    successes,
    failures,
    errorRate: samples === 0 ? null : failures / samples,
    p50: percentile(sortedOk, 0.5),
    p95: percentile(sortedOk, 0.95),
  };
}

async function jsonPost(url, body, extraHeaders) {
  const started = nowMs();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    const ms = nowMs() - started;
    return { ok: res.ok, status: res.status, ms, data };
  } catch (e) {
    const ms = nowMs() - started;
    return { ok: false, status: 0, ms, data: { error: String(e) } };
  }
}

function sampleResumeText() {
  return `Sample Resume (for latency smoke tests)

Anya Candidate • anya.candidate@example.com • (555) 010-1234 • Phoenix, AZ

SUMMARY
Software engineer with 3+ years of experience building web APIs, UI, and data pipelines.

EXPERIENCE
Acme Corp — Software Engineer (2022–2025)
- Built TypeScript services; improved p95 latency by 35% via caching and query tuning.
- Added CI + tests; reduced production incidents by 20%.

PROJECTS
RAG Resume Roaster
- Implemented retrieval-augmented generation; evaluated output structure and safety.

EDUCATION
B.S. Computer Science
`;
}

async function generateSamplePdfBuffer() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });
  doc.font('Helvetica').fontSize(12).text(sampleResumeText());
  doc.end();
  await done;
  return Buffer.concat(chunks);
}

async function generateSampleDocxBuffer() {
  const lines = sampleResumeText().split('\n');
  const paragraphs = lines.map((line) =>
    new Paragraph({
      children: [new TextRun({ text: line, break: 1 })],
    })
  );
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });
  return await Packer.toBuffer(doc);
}

async function readFixtureOrGenerateDefault() {
  try {
    if (!FIXTURE_PATH) throw Object.assign(new Error('no fixture path'), { code: 'ENOENT' });
    return await fs.readFile(FIXTURE_PATH);
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : '';
    if (code !== 'ENOENT') throw e;
    // Default to DOCX to avoid pdf-parse / xref issues during smoke runs.
    return await generateSampleDocxBuffer();
  }
}

function inferFixtureMeta() {
  if (!FIXTURE_PATH) {
    return { filename: 'sample_resume.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  }
  const lower = FIXTURE_PATH.toLowerCase();
  if (lower.endsWith('.docx')) {
    return { filename: path.basename(FIXTURE_PATH), mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  }
  return { filename: path.basename(FIXTURE_PATH), mime: 'application/pdf' };
}

function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function roastPost(email) {
  const fileBuf = await readFixtureOrGenerateDefault();
  const meta = inferFixtureMeta();
  const fd = new FormData();
  fd.set('file', new Blob([fileBuf], { type: meta.mime }), meta.filename);
  fd.set('provider', PROVIDER);
  if (MODEL) fd.set('model', MODEL);
  fd.set('roastLevel', ROAST_LEVEL);
  fd.set('jobDescription', JOB_DESCRIPTION);
  fd.set('directions', DIRECTIONS);

  // The roast route tries to read NextAuth cookies; but userId is optional for logging.
  // For smoke timings we only need the API response and roastLogId.
  for (let attempt = 0; attempt <= ROAST_RETRY_MAX; attempt++) {
    const started = nowMs();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(`${BASE_URL}/api/roast`, { method: 'POST', body: fd, signal: controller.signal });
      clearTimeout(timeout);
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }
      const ms = nowMs() - started;
      const ok = res.ok;
      const status = res.status;

      // Backend maps provider 429/quota -> 502 with a friendly message.
      const msg = typeof data?.error === 'string' ? data.error.toLowerCase() : '';
      const isRateLimited = status === 502 && (msg.includes('rate') || msg.includes('quota'));
      if (!ok && isRateLimited && attempt < ROAST_RETRY_MAX) {
        await sleepMs(15000 * (attempt + 1));
        continue;
      }
      return { ok, status, ms, data };
    } catch (e) {
      const ms = nowMs() - started;
      if (attempt < ROAST_RETRY_MAX) {
        await sleepMs(1500 * (attempt + 1));
        continue;
      }
      return { ok: false, status: 0, ms, data: { error: String(e) } };
    } finally {
      if (ROAST_DELAY_MS > 0) {
        await sleepMs(ROAST_DELAY_MS);
      }
    }
  }
  return { ok: false, status: 0, ms: 0, data: { error: 'unreachable' } };
}

async function runBatched(label, fn, { warmup = 0, samples, concurrency = 1 }) {
  const durationsMs = [];
  const okFlags = [];
  const statuses = new Map();

  async function one(i) {
    const r = await fn(i);
    durationsMs.push(r.ms);
    okFlags.push(Boolean(r.ok));
    statuses.set(r.status, (statuses.get(r.status) || 0) + 1);
    if (PROGRESS_EVERY > 0) {
      const done = durationsMs.length;
      if (done % PROGRESS_EVERY === 0 || done === samples) {
        const ok = okFlags.filter(Boolean).length;
        const fail = done - ok;
        const lastStatus = r.status;
        const lastMs = Math.round(r.ms);
        process.stdout.write(
          `${label}: ${done}/${samples} done (ok:${ok} fail:${fail}) last={status:${lastStatus} ms:${lastMs}}\n`
        );
      }
    }
    return r;
  }

  for (let i = 0; i < warmup; i++) {
    await fn(-1 - i);
  }

  let next = 0;
  const workers = new Array(Math.max(1, concurrency)).fill(0).map(async () => {
    while (true) {
      const i = next++;
      if (i >= samples) break;
      await one(i);
    }
  });

  await Promise.all(workers);
  const s = summarize(durationsMs, okFlags);
  return { label, durationsMs, okFlags, statuses, summary: s };
}

function formatMs(ms) {
  if (ms == null) return 'n/a';
  return `${Math.round(ms)} ms`;
}

function formatSecondsFromMs(ms) {
  if (ms == null) return 'n/a';
  return `${(ms / 1000).toFixed(3)} seconds`;
}

function printSection(title, result, { roastSeconds = false } = {}) {
  const s = result.summary;
  const p50 = roastSeconds ? formatSecondsFromMs(s.p50) : formatMs(s.p50);
  const p95 = roastSeconds ? formatSecondsFromMs(s.p95) : formatMs(s.p95);

  console.log(`\n${title}`);
  console.log(`samples: ${s.samples} (success: ${s.successes}, failed: ${s.failures})`);
  console.log(`error rate: ${s.errorRate == null ? 'n/a' : s.errorRate.toFixed(4)}`);
  console.log(`p50 latency: ${p50}`);
  console.log(`p95 latency: ${p95}`);
}

function printFinalSnippets(roastResult, feedbackResult) {
  const roast = roastResult.summary;
  const feedback = feedbackResult.summary;

  console.log('\n--- Pasteable report lines ---');
  console.log(`Roast generation p50 latency: ${formatSecondsFromMs(roast.p50)}`);
  console.log(`Roast generation p95 latency: ${formatSecondsFromMs(roast.p95)}`);
  console.log(`Feedback submission p50 latency: ${formatMs(feedback.p50)}`);
}

async function main() {
  console.log('SER594 latency smoke runner');
  console.log(`base: ${BASE_URL}`);
  console.log(`samples: ${SAMPLES} (warmup: ${WARMUP}, concurrency: ${CONCURRENCY})`);
  console.log(`provider/model: ${PROVIDER}${MODEL ? ` / ${MODEL}` : ''}`);
  console.log(`fixture: ${FIXTURE_PATH || '(generated: sample_resume.docx)'}`);
  console.log(`timeout: ${REQUEST_TIMEOUT_MS} ms (set SMOKE_REQUEST_TIMEOUT_MS to change)`);
  console.log(`progress: every ${PROGRESS_EVERY} requests (set SMOKE_PROGRESS_EVERY=0 to disable)`);
  if (ROAST_DELAY_MS > 0) console.log(`roast delay: ${ROAST_DELAY_MS} ms (set SMOKE_ROAST_DELAY_MS=0 to disable)`);

  // We reuse one account for login; register per-iteration to exercise that endpoint.
  const loginEmail = `smoke.login.${Date.now()}@example.com`;

  // Create login account once.
  {
    console.log('\nPreflight: creating login account (register once)');
    const r = await jsonPost(`${BASE_URL}/api/register`, { email: loginEmail, password: PASSWORD, name: 'Smoke Login' });
    if (!r.ok && r.status !== 409) {
      console.error('Failed to create login account. Is the backend running on port 4000?');
      console.error('Expected backend base:', BASE_URL);
      console.error('Status/data:', r.status, r.data);
      process.exit(1);
    }
  }

  console.log('\nPhase: register (many unique users)');
  const registerRes = await runBatched(
    'Register user (POST /api/register)',
    async (i) => {
      const email = `smoke.register.${Date.now()}.${i}@example.com`;
      return await jsonPost(`${BASE_URL}/api/register`, { email, password: PASSWORD, name: 'Smoke Register' });
    },
    { warmup: WARMUP, samples: SAMPLES, concurrency: Math.min(CONCURRENCY, 5) }
  );

  console.log('\nPhase: login (verify credentials)');
  const loginRes = await runBatched(
    'Login user (POST /api/internal/verify-credentials)',
    async () => {
      const headers = {};
      if (process.env.INTERNAL_AUTH_SECRET) headers['x-internal-auth'] = process.env.INTERNAL_AUTH_SECRET;
      const r = await jsonPost(
        `${BASE_URL}/api/internal/verify-credentials`,
        { email: loginEmail, password: PASSWORD },
        headers
      );
      if (!r.ok && (r.status === 401 || r.status === 503) && PROGRESS_EVERY > 0) {
        process.stdout.write(
          `Login note: received ${r.status}. If this stays 401, confirm DB+migrations ran and the register call is writing to the same DATABASE_URL the verify endpoint reads.\n`
        );
      }
      return r;
    },
    { warmup: WARMUP, samples: SAMPLES, concurrency: CONCURRENCY }
  );

  let lastRoastLogId = null;
  console.log('\nPhase: roast (LLM calls; expect this to take the longest)');
  const roastRes = await runBatched(
    'Generate roast (POST /api/roast)',
    async (i) => {
      const r = await roastPost(`smoke.roast.${i}@example.com`);
      const id = r?.data?.roastLogId;
      if (typeof id === 'string') lastRoastLogId = id;
      return r;
    },
    { warmup: 1, samples: SAMPLES, concurrency: 1 }
  );

  console.log('\nPhase: feedback');
  const feedbackRes = await runBatched(
    'Submit feedback (POST /api/roast/feedback)',
    async () => {
      if (!lastRoastLogId) {
        return { ok: false, status: 0, ms: 0, data: { error: 'Missing roastLogId (roast logging may be failing)' } };
      }
      return await jsonPost(`${BASE_URL}/api/roast/feedback`, {
        roastLogId: lastRoastLogId,
        thumbs: 'up',
        comment: 'Smoke test feedback.',
        tags: ['smoke'],
        includeInTraining: false,
      });
    },
    { warmup: 0, samples: SAMPLES, concurrency: Math.min(CONCURRENCY, 5) }
  );

  printSection('Register user', registerRes);
  printSection('Login user', loginRes);
  printSection('Roast generation', roastRes, { roastSeconds: true });
  printSection('Feedback submission', feedbackRes);

  printFinalSnippets(roastRes, feedbackRes);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

