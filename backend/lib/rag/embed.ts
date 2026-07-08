import OpenAI from 'openai';

/** Stored in Postgres as `vector(768)`; OpenAI 3-small uses `dimensions`; Nomic v1.5 defaults to 768. */
export const EMBEDDING_DIMENSION = 768;

const DEFAULT_OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const NOMIC_EMBED_URL = 'https://api-atlas.nomic.ai/v1/embedding/text';
const DEFAULT_NOMIC_EMBEDDING_MODEL = 'nomic-embed-text-v1.5';

export type EmbeddingProviderName = 'openai' | 'nomic';

export type EmbedTextOptions = {
  /** Nomic only: use `search_document` when embedding corpus chunks, `search_query` for live retrieval queries. */
  nomicTaskType?: 'search_query' | 'search_document';
};

/**
 * `EMBEDDING_PROVIDER=openai|nomic` when set (and the matching key exists).
 * Auto: **Nomic** if `NOMIC_API_KEY`, else **OpenAI** if `OPENAI_API_KEY` or `EMBEDDING_API_KEY`.
 * `EMBEDDING_PROVIDER=groq` is accepted for older configs: Groq Cloud has no public embedding models — resolves to nomic or openai like auto.
 */
export function resolveEmbeddingProvider(): EmbeddingProviderName | null {
  const explicit = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();
  if (explicit === 'openai') {
    return process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY ? 'openai' : null;
  }
  if (explicit === 'nomic') {
    return process.env.NOMIC_API_KEY ? 'nomic' : null;
  }
  if (explicit === 'groq') {
    if (process.env.NOMIC_API_KEY) return 'nomic';
    if (process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY) return 'openai';
    return null;
  }
  if (process.env.NOMIC_API_KEY) return 'nomic';
  if (process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY) return 'openai';
  return null;
}

async function embedViaNomic(
  text: string,
  taskType: 'search_query' | 'search_document'
): Promise<number[]> {
  const key = process.env.NOMIC_API_KEY!;
  const model = process.env.NOMIC_EMBEDDING_MODEL?.trim() || DEFAULT_NOMIC_EMBEDDING_MODEL;
  const res = await fetch(NOMIC_EMBED_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      texts: [text],
      task_type: taskType,
    }),
  });
  const errBody = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`Nomic embedding failed (${res.status}): ${errBody || res.statusText}`);
  }
  let data: { embeddings?: number[][] };
  try {
    data = JSON.parse(errBody) as { embeddings?: number[][] };
  } catch {
    throw new Error('Nomic embedding: invalid JSON response');
  }
  const vec = data.embeddings?.[0];
  if (!vec || vec.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Nomic embedding dimension mismatch: got ${vec?.length}, expected ${EMBEDDING_DIMENSION}`);
  }
  return vec;
}

export async function embedText(text: string, options?: EmbedTextOptions): Promise<number[] | null> {
  const provider = resolveEmbeddingProvider();
  if (!provider) return null;
  const trimmed = text.trim().slice(0, 8000);
  if (!trimmed) return null;

  if (provider === 'nomic') {
    const taskType = options?.nomicTaskType ?? 'search_document';
    return embedViaNomic(trimmed, taskType);
  }

  const key = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_OPENAI_EMBEDDING_MODEL;
  const client = new OpenAI({ apiKey: key });
  const res = await client.embeddings.create({
    model,
    input: trimmed,
    dimensions: EMBEDDING_DIMENSION,
  });
  const vec = res.data[0]?.embedding;
  if (!vec || vec.length !== EMBEDDING_DIMENSION) return null;
  return vec;
}
