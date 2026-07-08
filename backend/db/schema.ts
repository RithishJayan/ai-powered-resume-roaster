import {
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** RAG embeddings: Nomic Atlas v1.5 (768) or OpenAI text-embedding-3-small @ 768 dims. */
const EMBED_DIM = 768;

/** pgvector text input must be `[f1,f2,...]` — raw arrays bind as Postgres float8[], which breaks `vector`. */
function toPgVectorLiteral(values: number[]): string {
  return `[${values.map((n) => (Number.isFinite(n) ? n : 0)).join(',')}]`;
}

function fromPgVectorValue(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((v) => Number(v));
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.startsWith('[') && t.endsWith(']') && t.length > 1) {
      return t
        .slice(1, -1)
        .split(',')
        .map((x) => Number.parseFloat(x.trim()));
    }
  }
  return [];
}

export const vector768 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${EMBED_DIM})`;
  },
  toDriver(value) {
    return toPgVectorLiteral(value);
  },
  fromDriver(value) {
    return fromPgVectorValue(value);
  },
});

export const ragChunks = pgTable('rag_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: varchar('kind', { length: 32 }).notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  embedding: vector768('embedding'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const roastLogs = pgTable('roast_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  provider: varchar('provider', { length: 32 }).notNull(),
  model: text('model').notNull(),
  roastLevel: varchar('roast_level', { length: 16 }).notNull(),
  jobDescriptionHash: text('job_description_hash'),
  resumeTextHash: text('resume_text_hash').notNull(),
  resumeExcerpt: text('resume_excerpt'),
  resumeFullText: text('resume_full_text'),
  roastText: text('roast_text').notNull(),
  score: integer('score'),
  breakdown: jsonb('breakdown').$type<{ name: string; score: number }[]>(),
  aiAssessment: jsonb('ai_assessment').$type<{ score: number; label: string; signs: string[] }>(),
  latencyMs: integer('latency_ms'),
  ragChunkIds: jsonb('rag_chunk_ids').$type<string[]>().default([]).notNull(),
  moderation: jsonb('moderation').$type<Record<string, unknown>>(),
});

export const roastFeedback = pgTable('roast_feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  roastLogId: uuid('roast_log_id')
    .notNull()
    .references(() => roastLogs.id, { onDelete: 'cascade' }),
  rating: integer('rating'),
  thumbs: varchar('thumbs', { length: 8 }),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  comment: text('comment'),
  includeInTraining: boolean('include_in_training').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type RagChunk = typeof ragChunks.$inferSelect;
export type User = typeof users.$inferSelect;
export type RoastLog = typeof roastLogs.$inferSelect;
export type RoastFeedback = typeof roastFeedback.$inferSelect;
