import { eq } from 'drizzle-orm';
import { getDb, getSql } from '@/db';
import { ragChunks } from '@/db/schema';
import { EMBEDDING_DIMENSION } from '@/lib/rag/embed';

export type RetrievedChunk = {
  id: string;
  kind: string;
  title: string;
  body: string;
  distance: number;
};

const DEFAULT_LIMIT = 6;
const DEFAULT_MAX_DISTANCE = 0.55;

export async function searchSimilarRagChunks(
  embedding: number[],
  options?: { limit?: number; maxDistance?: number }
): Promise<RetrievedChunk[]> {
  const sqlClient = getSql();
  if (!sqlClient || embedding.length !== EMBEDDING_DIMENSION) return [];
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const maxDistance = options?.maxDistance ?? DEFAULT_MAX_DISTANCE;
  const vectorStr = `[${embedding.map((n) => (Number.isFinite(n) ? n : 0)).join(',')}]`;
  const rows = await sqlClient`
    SELECT id::text AS id, kind, title, body, (embedding <=> ${vectorStr}::vector) AS dist
    FROM rag_chunks
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;
  const out: RetrievedChunk[] = [];
  const rowList = rows as unknown as { id: string; kind: string; title: string; body: string; dist: number }[];
  for (const row of rowList) {
    const dist = Number(row.dist);
    if (!row.id || dist > maxDistance) continue;
    out.push({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      distance: dist,
    });
  }
  return out;
}

export async function fetchFewShotChunksByKind(limit = 4): Promise<RetrievedChunk[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: ragChunks.id,
      kind: ragChunks.kind,
      title: ragChunks.title,
      body: ragChunks.body,
    })
    .from(ragChunks)
    .where(eq(ragChunks.kind, 'few_shot'))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    distance: 0,
  }));
}
