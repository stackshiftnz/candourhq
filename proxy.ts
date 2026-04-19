import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Route classification ─────────────────────────────────────────────────────

// Paths that require an authenticated session.
// Unauthenticated requests → redirect to /signin.
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/new',
  '/sample',
  '/history',
  '/analyse',
  '/clean',
  '/export',
  '/onboarding',
  '/settings',
]

// Paths that must not be reached when already authenticated.
// Authenticated requests → redirect to /dashboard.
const AUTH_ONLY_ROUTES = ['/signin', '/signup']

// Everything else (/reset-password, /update-password, /, /api/*, etc.)
// is public — no redirect in either direction, just session refresh.

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  // Start with a plain pass-through response so we can forward cookies.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Forward cookies onto both the request and the response so the
          // session is refreshed correctly on every navigation.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the JWT server-side and refreshes the session.
  // Do NOT replace this with getSession() — getSession() does not validate
  // the token against Supabase and is not safe for auth decisions.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Is this a protected route? ──────────────────────────────────────────────

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  )

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/signin'
    // Preserve the intended destination so we could implement a returnTo
    // flow later — harmless for now.
    redirectUrl.searchParams.set('reason', 'session-expired')
    return NextResponse.redirect(redirectUrl)
  }

  // ── Is this an auth-only route (signin / signup)? ───────────────────────────

  const isAuthOnly = AUTH_ONLY_ROUTES.includes(pathname)

  if (isAuthOnly && user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  // ── Pass through (public route or authorised request) ───────────────────────

  return supabaseResponse
}

// Apply middleware to all routes except static assets and images.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
