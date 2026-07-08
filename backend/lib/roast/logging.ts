import { createHash } from 'crypto';
import { getDb } from '@/db';
import { roastLogs } from '@/db/schema';
import type { ModerationResult } from '@/lib/roast/moderation';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export type InsertRoastLogInput = {
  userId?: string | null;
  provider: string;
  model: string;
  roastLevel: string;
  jobDescription: string;
  resumeText: string;
  roastText: string;
  score: number | null;
  breakdown: { name: string; score: number }[] | null;
  aiAssessment: { score: number; label: string; signs: string[] } | null;
  latencyMs: number;
  ragChunkIds: string[];
  moderation: ModerationResult | Record<string, unknown> | null;
};

export async function insertRoastLog(input: InsertRoastLogInput): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const storeFull = process.env.ROAST_LOG_STORE_FULL_TEXT === 'true';
  const excerptLen = Math.max(0, Math.min(8000, Number(process.env.ROAST_LOG_STORE_EXCERPT_CHARS ?? '500') || 500));

  const jobHash = input.jobDescription.trim() ? sha256Hex(input.jobDescription) : null;
  const resumeHash = sha256Hex(input.resumeText);
  const excerpt = excerptLen > 0 ? input.resumeText.slice(0, excerptLen) : null;

  const [row] = await db
    .insert(roastLogs)
    .values({
      userId: input.userId ?? null,
      provider: input.provider,
      model: input.model,
      roastLevel: input.roastLevel,
      jobDescriptionHash: jobHash,
      resumeTextHash: resumeHash,
      resumeExcerpt: excerpt,
      resumeFullText: storeFull ? input.resumeText : null,
      roastText: input.roastText,
      score: input.score ?? null,
      breakdown: input.breakdown ?? null,
      aiAssessment: input.aiAssessment ?? null,
      latencyMs: input.latencyMs,
      ragChunkIds: input.ragChunkIds,
      moderation: input.moderation as Record<string, unknown> | null,
    })
    .returning({ id: roastLogs.id });

  return row?.id ?? null;
}
