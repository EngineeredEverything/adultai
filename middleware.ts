import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const ageVerified = request.cookies.get('age_verified');
  const isHomePage = request.nextUrl.pathname === '/';
  const isPublicPath = request.nextUrl.pathname.startsWith('/public/');

  // Store the original URL as a callback
  const callbackUrl = request.nextUrl.pathname;

  // If not verified and not on public paths, redirect to home with callback
  if (!ageVerified && !isHomePage && !isPublicPath) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('callbackUrl', callbackUrl);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|logo.png|images).*)',
  ],
};
