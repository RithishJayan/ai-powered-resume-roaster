import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  // eslint-disable-next-line no-var -- Next.js hot reload singleton
  var __resumeRoastDb: DrizzleDb | undefined;
  // eslint-disable-next-line no-var
  var __resumeRoastSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const sql = postgres(url, { max: 10 });
  const db = drizzle(sql, { schema });
  return { sql, db };
}

/** Raw postgres.js client for vector queries (Drizzle execute typing varies). */
export function getSql(): ReturnType<typeof postgres> | null {
  getDb(); // ensure client exists
  return global.__resumeRoastSql ?? null;
}

/** Returns null when DATABASE_URL is unset (roasts still work without persistence). */
export function getDb(): DrizzleDb | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (process.env.NODE_ENV === 'production') {
    if (!global.__resumeRoastSql) {
      const c = createClient();
      if (!c) return null;
      global.__resumeRoastSql = c.sql;
      global.__resumeRoastDb = c.db;
    }
    return global.__resumeRoastDb ?? null;
  }
  if (!global.__resumeRoastSql) {
    const c = createClient();
    if (!c) return null;
    global.__resumeRoastSql = c.sql;
    global.__resumeRoastDb = c.db;
  }
  return global.__resumeRoastDb ?? null;
}

export { schema };
