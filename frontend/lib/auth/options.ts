import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

function getBackendBaseUrl(): string {
  return (process.env.BACKEND_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const emailRaw = credentials?.email;
        const password = credentials?.password;
        if (!emailRaw || !password || typeof emailRaw !== 'string' || typeof password !== 'string') {
          return null;
        }
        const email = emailRaw.trim().toLowerCase();
        const backend = getBackendBaseUrl();
        const internalSecret = process.env.INTERNAL_AUTH_SECRET;
        try {
          const res = await fetch(`${backend}/api/internal/verify-credentials`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(internalSecret ? { 'x-internal-auth': internalSecret } : {}),
            },
            body: JSON.stringify({ email, password }),
          });
          if (!res.ok) return null;
          const data = (await res.json()) as {
            user?: { id: string; email: string; name?: string };
          };
          if (!data.user?.id || !data.user.email) return null;
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name ?? undefined,
          };
        } catch (e) {
          console.error('NextAuth authorize: backend verify failed', e);
          return null;
        }
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
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (token.id) session.user.id = token.id as string;
        if (token.email) session.user.email = token.email as string;
        if (token.name) session.user.name = token.name as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
