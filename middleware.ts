import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Age verification is handled client-side by AgeVerificationProvider overlay.
// No server-side redirect needed — this eliminates the 307 round-trip on every
// page visit and allows Cloudflare to cache pages properly.

export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|logo.png|images).*)',
  ],
};
