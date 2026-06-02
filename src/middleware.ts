import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define public paths
  const publicPaths = [
    '/waitlist',
    '/api/waitlist/join',
    '/api/auth/token-login',
    '/login',
    '/auth/callback',
  ];

  if (publicPaths.some(path => pathname === path || pathname.startsWith(path + '/'))) {
    return NextResponse.next();
  }

  // Check for authentication: Supabase sb-* cookie or mock gamegata-session cookie
  const cookies = request.cookies.getAll();
  const hasSupabaseCookie = cookies.some(cookie => 
    cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  );
  const hasMockCookie = request.cookies.has('gamegata-session');
  const isAuthenticated = hasSupabaseCookie || hasMockCookie;

  if (!isAuthenticated) {
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized. Early access only.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/waitlist';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};