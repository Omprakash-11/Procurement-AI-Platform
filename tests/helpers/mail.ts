// Local Supabase routes our emails to Mailpit (decision P3-3); tests read them from its API.
const MAILPIT = 'http://127.0.0.1:54324'

type Message = { ID: string; Subject: string }

export async function messagesTo(email: string): Promise<Message[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
  return ((await res.json()) as { messages?: Message[] }).messages ?? []
}

export async function waitForMail(email: string, subject: string | RegExp, timeoutMs = 10_000): Promise<{ html: string; text: string }> {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    const hit = (await messagesTo(email)).find((m) => (typeof subject === 'string' ? m.Subject === subject : subject.test(m.Subject)))
    if (hit) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`)).json()) as { HTML: string; Text: string }
      return { html: full.HTML, text: full.Text }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`No email "${String(subject)}" to ${email}`)
}

export async function clearMail() {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' })
}
