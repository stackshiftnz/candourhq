import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ─── Auth callback ────────────────────────────────────────────────────────────
//
// Handles the PKCE code exchange after email confirmation.
// Exchanges the one-time code for a session, checks onboarding status,
// then redirects to /onboarding or /dashboard as appropriate.
// An optional ?next= param overrides the default routing (used for
// password reset which needs to land on /update-password).

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') // explicit override (e.g. /update-password)

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Called from a Server Component — middleware handles refresh.
            }
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Explicit next param takes priority (e.g. password reset → /update-password)
      if (next) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      // Check onboarding status to decide where to send the user
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', data.user.id)
        .single()

      const destination = profile?.onboarding_completed ? '/dashboard' : '/onboarding'
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  // Expired or missing code
  return NextResponse.redirect(`${origin}/signin?error=invalid_link`)
}
