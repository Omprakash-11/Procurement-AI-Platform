import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Vendor portal — ProcureMaster' }

// Placeholder: the vendor shell is built in Phase 4 and the portal home in Phase 6.
// Exists now so vendor sign-in has a landing page (App Flow §3: vendors → /vendor).
export default function VendorHomePage() {
  return (
    <main className="mx-auto max-w-7xl px-8 py-8">
      <h1 className="font-heading text-3xl text-foreground">Vendor portal</h1>
    </main>
  )
}
