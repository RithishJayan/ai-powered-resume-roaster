import type { Context } from 'hono';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { users } from '@/db/schema';

/** NextAuth Credentials: verify email/password; optional INTERNAL_AUTH_SECRET via x-internal-auth. */
export async function internalVerifyPost(c: Context) {
  const expected = process.env.INTERNAL_AUTH_SECRET;
  if (expected && c.req.header('x-internal-auth') !== expected) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
  const b = body as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  if (!email || !password) {
    return c.json({ error: 'Invalid credentials' }, 400);
  }

  const db = getDb();
  if (!db) {
    return c.json({ error: 'Database unavailable' }, 503);
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
    },
  });
}
