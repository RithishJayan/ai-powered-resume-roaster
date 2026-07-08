import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

function backendBase(): string {
  return (process.env.BACKEND_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const secret = process.env.INTERNAL_AUTH_SECRET;
        if (secret) {
          headers['x-internal-auth'] = secret;
        }

        const res = await fetch(`${backendBase()}/api/internal/verify-credentials`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) return null;

        const data = (await res.json()) as {
          user?: { id?: string; email?: string; name?: string };
        };
        const u = data.user;
        if (!u?.id || !u.email) return null;

        return {
          id: u.id,
          email: u.email,
          name: u.name ?? undefined,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.sub = user.id;
        if (user.email) token.email = user.email;
        if (user.name != null) token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        if (token.email) session.user.email = token.email as string;
        session.user.name = (token.name as string | undefined) ?? session.user.name;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
