import OpenAI from 'openai';

export type ModerationResult = {
  flagged: boolean;
  categories?: Record<string, boolean>;
  scores?: Record<string, number>;
  source: 'openai' | 'blocklist' | 'none';
};

const BLOCKLIST_PATTERNS = [
  /\b(kill\s+yourself|kys)\b/i,
  /\b(n[i1]g{1,2}[e3]r|n[i1]gg[a@])\b/i,
  /\b(f[a@]gg[o0]t)\b/i,
  /\b(r[e3]t[a@]rd)\b/i,
];

export function checkBlocklist(text: string): ModerationResult {
  for (const re of BLOCKLIST_PATTERNS) {
    if (re.test(text)) {
      return { flagged: true, source: 'blocklist' };
    }
  }
  return { flagged: false, source: 'none' };
}

export async function moderateWithOpenAI(text: string): Promise<ModerationResult | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const client = new OpenAI({ apiKey: key });
    const res = await client.moderations.create({ input: text.slice(0, 32000) });
    const r = res.results[0];
    if (!r) return null;
    return {
      flagged: r.flagged,
      categories: r.categories as unknown as Record<string, boolean>,
      scores: (r.category_scores ?? {}) as unknown as Record<string, number>,
      source: 'openai',
    };
  } catch {
    return null;
  }
}

/** Combine OpenAI moderation (if available) with local blocklist. */
export async function moderateRoastOutput(text: string): Promise<ModerationResult> {
  const block = checkBlocklist(text);
  if (block.flagged) return block;
  const openai = await moderateWithOpenAI(text);
  if (openai?.flagged) return openai;
  if (openai && !openai.flagged) return openai;
  return { flagged: false, source: 'none' };
}

export function shouldBlockForCategories(m: ModerationResult): boolean {
  if (!m.flagged) return false;
  if (m.source === 'blocklist') return true;
  const s = m.scores ?? {};
  const hate = s.hate ?? 0;
  const harassment = s.harassment ?? s.harassment_threatening ?? 0;
  const sexual = s.sexual ?? 0;
  const selfHarm = s['self-harm'] ?? s.self_harm ?? 0;
  return hate > 0.35 || harassment > 0.45 || sexual > 0.55 || selfHarm > 0.35;
}
