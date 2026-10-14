import { redirect } from 'next/navigation'

// App Flow: root (/) redirects to /login (middleware sends signed-in users on to their home).
export default function HomePage() {
  redirect('/login')
}
