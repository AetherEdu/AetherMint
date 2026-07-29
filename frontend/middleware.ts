import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * Next.js Middleware for Content Security Policy (CSP)
 * 
 * Generates a unique nonce per request and injects strict CSP headers.
 * Uses report-only mode initially to identify violations before enforcement.
 * 
 * Features:
 * - Nonce-based script execution (no unsafe-inline or unsafe-eval)
 * - frame-ancestors 'none' to prevent clickjacking
 * - CSP violation reporting to backend endpoint
 */
export function middleware(request: NextRequest) {
  // Generate cryptographically secure nonce
  const nonce = crypto.randomBytes(16).toString('base64');

  // Create response
  const response = NextResponse.next();

  // Set nonce in secure, httpOnly cookie for _document.tsx to read during SSR
  response.cookies.set('__csp_nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  });

  // Also set nonce in response header for _document.tsx getInitialProps
  response.headers.set('x-csp-nonce', nonce);

  // Build strict CSP directives with nonce
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`, // Nonce-based, no unsafe-inline/unsafe-eval
    `style-src 'self' 'nonce-${nonce}'`,  // Nonce-based, no unsafe-inline
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' wss: ws: https:",
    "object-src 'none'",
    "frame-ancestors 'none'", // Prevent clickjacking
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "manifest-src 'self'",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "report-uri /api/csp-violation",
  ];

  const cspValue = cspDirectives.join('; ');

  // Use report-only mode for initial rollout (controlled by NEXT_PUBLIC_CSP_ENFORCE)
  const enforceCsp = process.env.NEXT_PUBLIC_CSP_ENFORCE === 'true';

  if (enforceCsp) {
    response.headers.set('Content-Security-Policy', cspValue);
  } else {
    response.headers.set('Content-Security-Policy-Report-Only', cspValue);
  }

  // Add additional security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

/**
 * Middleware configuration
 * Match all paths except:
 * - _next/static (static assets)
 * - _next/image (Next.js image optimizer)
 * - favicon.ico
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};