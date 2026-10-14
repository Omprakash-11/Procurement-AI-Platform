import { NextResponse, type NextRequest } from 'next/server'

import { safeRedirectPath } from '@/lib/auth/routes'
import { createClient } from '@/lib/supabase/server'

// GET /auth/confirm — decision P3-2. Verifies the emailed one-time link (this confirms the
// email address), sets the session cookies, then continues to `next`.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const next = safeRedirectPath(searchParams.get('next'), '/dashboard')

  if (tokenHash) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type: 'email', token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(next, request.url))
  }

  return NextResponse.redirect(new URL('/login?reason=link_expired', request.url))
}
