import type { Context } from 'hono';
import bcrypt from 'bcryptjs';
import { getDb } from '@/db';
import { users } from '@/db/schema';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_EMAIL = 320;

export async function registerPost(c: Context) {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
  const b = body as Record<string, unknown>;
  const emailRaw = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 120) : null;

  if (!emailRaw || emailRaw.length > MAX_EMAIL || !EMAIL_RE.test(emailRaw)) {
    return c.json({ error: 'Valid email is required' }, 400);
  }
  if (password.length < MIN_PASSWORD) {
    return c.json({ error: `Password must be at least ${MIN_PASSWORD} characters` }, 400);
  }

  const db = getDb();
  if (!db) {
    return c.json(
      {
        error: 'Registration unavailable (database not configured)',
        hint: 'Set DATABASE_URL in .env.local, start Postgres (docker compose up -d), run npm run db:migrate from the monorepo root, then restart npm run dev.',
      },
      503
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const [created] = await db
      .insert(users)
      .values({
        email: emailRaw,
        passwordHash,
        name: name || null,
      })
      .returning({ id: users.id });
    return c.json({ ok: true, userId: created?.id ?? null }, 201);
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === '23505') {
      return c.json({ error: 'An account with this email already exists' }, 409);
    }
    console.error('Register error:', e);
    return c.json({ error: 'Could not create account' }, 500);
  }
}
