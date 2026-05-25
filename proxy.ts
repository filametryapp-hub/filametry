import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Skip auth checks when Supabase isn't configured yet (local dev without .env.local)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isOnboarding = pathname.startsWith('/onboarding')
  const isApiRoute = pathname.startsWith('/api')
  const isDashboard = pathname.startsWith('/dashboard') ||
                      pathname.startsWith('/precificacao') ||
                      pathname.startsWith('/filamentos') ||
                      pathname.startsWith('/produtos') ||
                      pathname.startsWith('/pedidos') ||
                      pathname.startsWith('/clients') ||
                      pathname.startsWith('/suppliers') ||
                      pathname.startsWith('/expenses') ||
                      pathname.startsWith('/cash-flow') ||
                      pathname.startsWith('/billing') ||
                      pathname.startsWith('/printers') ||
                      pathname.startsWith('/wallet') ||
                      pathname.startsWith('/settings')

  if (!user && isDashboard) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Check onboarding: if user has no company yet, redirect to /onboarding
  // Exception: if the user's email is a registered partner, auto-link them to that company
  if (user && isDashboard && !isOnboarding && !isApiRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profile && !profile.company_id) {
      // Check if this user is a registered partner of any company
      const { data: partnerMatch } = await supabase
        .from('partners')
        .select('id, company_id')
        .eq('email', user.email ?? '')
        .maybeSingle()

      if (partnerMatch?.company_id) {
        // Auto-link this user to their partner's company
        await supabase.from('profiles').update({ company_id: partnerMatch.company_id }).eq('id', user.id)
        // Mark the partner record as active
        await supabase.from('partners').update({ user_id: user.id }).eq('id', partnerMatch.id)
        // Let them through to the dashboard
        return supabaseResponse
      }

      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
