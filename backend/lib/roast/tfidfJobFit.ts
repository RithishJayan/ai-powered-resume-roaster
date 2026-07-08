/**
 * Lexical overlap between resume and job description via TF-IDF (2 documents) + cosine.
 * This measures shared vocabulary / wording, not semantic quality or deep job fit.
 */

const MIN_JOB_CHARS = 50;
const MAX_RESUME_CHARS = 20_000;
const MAX_JOB_CHARS = 4000;

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'as',
  'by',
  'with',
  'from',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'can',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'we',
  'you',
  'your',
  'our',
  'their',
  'they',
  'who',
  'which',
]);

export type TfidfJobFitResult = {
  /** Cosine similarity of TF-IDF vectors, in [0, 1] for non-negative weights. */
  cosine: number;
  /** Rounded display score; lexical overlap, not semantic assessment. */
  score: number;
};

/** Stored on `roast_logs.lexical_scores` (JSON); optional key reserved for future lexical metrics. */
export type LexicalScoresPayload = { tfidfJobFit?: { cosine: number; score: number } };

export function toLexicalScoresPayload(result: TfidfJobFitResult | null): LexicalScoresPayload | null {
  if (!result) return null;
  return { tfidfJobFit: { cosine: result.cosine, score: result.score } };
}

function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];
  const re = /[a-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    const t = m[0];
    if (t.length < 2) continue;
    if (STOPWORDS.has(t)) continue;
    out.push(t);
  }
  return out;
}

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) {
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  return m;
}

/** Smoothed IDF for N=2 documents: log((1+N)/(1+df))+1 */
function idf(df: number): number {
  const n = 2;
  return Math.log((1 + n) / (1 + df)) + 1;
}

/**
 * Returns null if job text is too short, or either side has no tokens after processing.
 */
export function computeResumeJobTfidfCosine(resumeRaw: string, jobRaw: string): TfidfJobFitResult | null {
  const job = jobRaw.trim();
  if (job.length < MIN_JOB_CHARS) return null;

  const resumeText = resumeRaw.slice(0, MAX_RESUME_CHARS);
  const jobText = job.slice(0, MAX_JOB_CHARS);

  const resumeTokens = tokenize(resumeText);
  const jobTokens = tokenize(jobText);
  if (resumeTokens.length === 0 || jobTokens.length === 0) return null;

  const tfResume = termFreq(resumeTokens);
  const tfJob = termFreq(jobTokens);

  const vocab = new Set<string>([...tfResume.keys(), ...tfJob.keys()]);
  if (vocab.size === 0) return null;

  const df = new Map<string, number>();
  for (const t of vocab) {
    let d = 0;
    if (tfResume.has(t)) d++;
    if (tfJob.has(t)) d++;
    df.set(t, d);
  }

  let dot = 0;
  let normR = 0;
  let normJ = 0;

  for (const t of vocab) {
    const idfT = idf(df.get(t) ?? 1);
    const wR = (tfResume.get(t) ?? 0) * idfT;
    const wJ = (tfJob.get(t) ?? 0) * idfT;
    dot += wR * wJ;
    normR += wR * wR;
    normJ += wJ * wJ;
  }

  const denom = Math.sqrt(normR) * Math.sqrt(normJ);
  if (denom === 0 || !Number.isFinite(denom)) return null;

  const cosine = Math.min(1, Math.max(0, dot / denom));
  const score = Math.min(100, Math.max(0, Math.round(100 * cosine)));

  return { cosine, score };
}
