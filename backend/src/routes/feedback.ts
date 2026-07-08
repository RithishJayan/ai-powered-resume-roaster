import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { roastFeedback, roastLogs } from '@/db/schema';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function feedbackPost(c: Context) {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  const b = body as Record<string, unknown>;
  const roastLogId = typeof b.roastLogId === 'string' ? b.roastLogId.trim() : '';
  if (!roastLogId || !UUID_RE.test(roastLogId)) {
    return c.json({ error: 'Valid roastLogId (UUID) is required' }, 400);
  }

  const rating = typeof b.rating === 'number' && b.rating >= 1 && b.rating <= 5 ? Math.round(b.rating) : null;
  const thumbs = b.thumbs === 'up' || b.thumbs === 'down' ? b.thumbs : null;
  const comment = typeof b.comment === 'string' ? b.comment.trim().slice(0, 2000) : null;
  const tags = Array.isArray(b.tags) ? b.tags.filter((t): t is string => typeof t === 'string').slice(0, 12) : [];
  const includeInTraining = Boolean(b.includeInTraining);

  if (rating === null && thumbs === null && !comment && tags.length === 0) {
    return c.json({ error: 'Provide rating (1–5), thumbs (up/down), comment, or tags' }, 400);
  }

  const db = getDb();
  if (!db) {
    return c.json({ error: 'Feedback storage unavailable (DATABASE_URL not set)' }, 503);
  }

  const [log] = await db.select({ id: roastLogs.id }).from(roastLogs).where(eq(roastLogs.id, roastLogId)).limit(1);
  if (!log) {
    return c.json({ error: 'Roast log not found' }, 404);
  }

  await db.insert(roastFeedback).values({
    roastLogId,
    rating,
    thumbs,
    tags,
    comment: comment || null,
    includeInTraining,
  });

  return c.json({ ok: true });
}
