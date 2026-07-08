/**
 * Chunk markdown under rag/corpus/{kind}/*.md, embed, upsert into rag_chunks.
 * Run: npm run rag:ingest
 * Requires DATABASE_URL and NOMIC_API_KEY and/or OPENAI_API_KEY (see lib/rag/embed.ts).
 */
import { config } from 'dotenv';
import { readdirSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ragChunks } from '../db/schema';
import * as schema from '../db/schema';
import { embedText, resolveEmbeddingProvider } from '../lib/rag/embed';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/** Backend package root (parent of `scripts/`). */
const BACKEND_ROOT = resolve(__dirname, '..');

config({ path: join(BACKEND_ROOT, '.env.local') });
config({ path: join(BACKEND_ROOT, '.env') });
config({ path: join(BACKEND_ROOT, '..', '.env.local') });
config({ path: join(BACKEND_ROOT, '..', '.env') });

const CORPUS_ROOT = join(BACKEND_ROOT, 'rag', 'corpus');
const CHUNK_CHARS = 900;
const CHUNK_OVERLAP = 150;

const KINDS = ['style_guide', 'few_shot', 'industry'] as const;

function chunkText(text: string): string[] {
  const t = text.replace(/\r\n/g, '\n').trim();
  if (!t) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(t.length, i + CHUNK_CHARS);
    chunks.push(t.slice(i, end).trim());
    if (end === t.length) break;
    i = Math.max(end - CHUNK_OVERLAP, i + 1);
  }
  return chunks.filter(Boolean);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  if (!resolveEmbeddingProvider()) {
    console.error(
      'No embedding keys: set NOMIC_API_KEY (free at https://atlas.nomic.ai) and/or OPENAI_API_KEY or EMBEDDING_API_KEY. Optional: EMBEDDING_PROVIDER=nomic|openai. (Groq has no embedding API on GroqCloud.)'
    );
    process.exit(1);
  }

  const sql = postgres(url, { max: 5 });
  const db = drizzle(sql, { schema });

  if (process.argv.includes('--replace')) {
    await db.delete(ragChunks);
    console.log('Cleared rag_chunks (--replace).');
  }

  let total = 0;
  for (const kind of KINDS) {
    const dir = join(CORPUS_ROOT, kind);
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    } catch {
      console.warn(`Skip missing dir: ${dir}`);
      continue;
    }

    for (const file of files) {
      const raw = readFileSync(join(dir, file), 'utf8');
      const title = `${kind}/${file}`;
      const parts = chunkText(raw);
      let idx = 0;
      for (const body of parts) {
        const vec = await embedText(body, { nomicTaskType: 'search_document' });
        if (!vec) {
          throw new Error('embedText returned null (check API keys and embedding model)');
        }
        await db.insert(ragChunks).values({
          kind,
          title: parts.length > 1 ? `${title}#${idx}` : title,
          body,
          metadata: { sourceFile: file, chunkIndex: idx },
          embedding: vec,
        });
        idx += 1;
        total += 1;
        process.stdout.write('.');
      }
    }
  }

  await sql.end();
  console.log(`\nDone. Inserted ${total} chunk(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
