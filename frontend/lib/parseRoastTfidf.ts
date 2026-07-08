export type TfidfJobFitClient = { score: number; cosine: number };

/**
 * Parses `tfidfJobFit` from a successful POST /api/roast JSON body.
 */
export function parseTfidfJobFitFromRoastResponse(data: unknown): TfidfJobFitClient | null {
  if (!data || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  const raw = root.tfidfJobFit;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.score !== 'number' || typeof o.cosine !== 'number') return null;
  return { score: o.score, cosine: o.cosine };
}
