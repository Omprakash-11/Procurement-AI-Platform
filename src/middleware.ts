import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getAppClaims, homePathFor } from '@/lib/auth/claims'
import { canAccess, isAuthOnlyPage, isInternalPath, isPublicPath, isVendorPath } from '@/lib/auth/routes'

// Implementation Plan Phase 3: protect (dashboard) and /vendor; send signed-in users home
// from /login and /signup; role-based redirects (App Flow §1, §10.2).
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

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
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // getUser() validates with the Auth server (refreshing the session if needed).
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  const path = request.nextUrl.pathname

  const redirectTo = (target: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone()
    url.pathname = target
    url.search = ''
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value)
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  if (path === '/') return redirectTo(user ? '/dashboard' : '/login')

  if (!user) {
    if (isPublicPath(path)) return response
    const hadSession = request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))
    return redirectTo('/login', {
      redirectTo: path + request.nextUrl.search,
      ...(hadSession ? { reason: 'expired' } : {}),
    })
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const claims = getAppClaims(sessionData.session?.access_token)
  const home = homePathFor(claims)

  // Signed in but no claims: the account was deactivated (the auth hook omits claims).
  if (!home) {
    if (isPublicPath(path)) return response
    await supabase.auth.signOut()
    return redirectTo('/login', { reason: 'disabled' })
  }

  if (isAuthOnlyPage(path)) return redirectTo(home)
  if (claims.user_type === 'vendor' && isInternalPath(path)) return redirectTo('/vendor')
  if (claims.user_type === 'internal' && isVendorPath(path)) return redirectTo('/dashboard')
  if (claims.user_type === 'internal' && isInternalPath(path) && !canAccess(path, claims)) {
    return redirectTo('/dashboard', { denied: '1' })
  }

  return response
}

export const config = {
  // Everything except API routes (they authenticate themselves), Next internals and static files.
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|pdf)$).*)'],
}
