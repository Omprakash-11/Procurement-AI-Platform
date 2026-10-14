import { redirect } from 'next/navigation'

// Decision P3-4: resets start from the "Forgot password?" modal on /login.
export default function ResetPasswordIndexPage() {
  redirect('/login')
}
