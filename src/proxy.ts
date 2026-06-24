import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LOCALES = ['en', 'nl', 'fr', 'de', 'es']
const DEFAULT_LOCALE = 'en'

// Routes that require an authenticated Supabase session.
// Unauthenticated visitors are redirected to the sign-in page.
const AUTH_REQUIRED = ['/favorites', '/trips', '/profile', '/dashboard']

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── Auth guard ────────────────────────────────────────────────────────────
  const needsAuth = AUTH_REQUIRED.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (needsAuth) {
    // Supabase stores the session in sb-<project-ref>-auth-token cookies.
    // The presence of the access-token cookie is a fast, edge-safe proxy for
    // "user is logged in". The actual token is verified server-side by Supabase
    // on every data request, so this check is for UX only (not a security boundary).
    const hasSession = [...req.cookies.getAll()].some(
      c => c.name.includes('-auth-token') && c.value.length > 10
    )
    if (!hasSession) {
      const signIn = req.nextUrl.clone()
      signIn.pathname = '/auth/signin'
      signIn.searchParams.set('next', pathname)
      return NextResponse.redirect(signIn)
    }
  }

  // ── Locale header (next-intl) ─────────────────────────────────────────────
  const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value
  const locale = cookieLocale && LOCALES.includes(cookieLocale) ? cookieLocale : DEFAULT_LOCALE

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('X-NEXT-INTL-LOCALE', locale)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
