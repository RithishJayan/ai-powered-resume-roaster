import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration: NEXTAUTH_SECRET is not set' }, { status: 500 });
  }

  const token = await getToken({ req: request, secret });
  if (!token) {
    const login = new URL('/login', request.url);
    login.searchParams.set('callbackUrl', request.nextUrl.pathname || '/');
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

/** Only the roast home page requires a session; /login and /register stay public. */
export const config = {
  matcher: ['/'],
};
