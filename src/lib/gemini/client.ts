import { GoogleGenAI } from '@google/genai'
import type { ZodType } from 'zod'

// Tech Stack §5 / decision P7-1 (revised 2026-10-15). Server-side only: GEMINI_API_KEY never
// reaches the client. Never import this file from a client component.

/** Tried in order: each model gets a few attempts on transient errors before the next one. */
export const MODEL_CHAIN = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'] as const

const TIMEOUT_MS = 120_000 // Tech Stack §5.2: generous timeout for large documents
/** Whole call incl. retries stays inside the processing routes' 300 s maxDuration (P7-2). */
const BUDGET_MS = 240_000
const ATTEMPTS_PER_MODEL = 3
const BACKOFF_MS = [2_000, 5_000] // waits between attempts on the same model

let client: GoogleGenAI | null = null
function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  client ??= new GoogleGenAI({ apiKey })
  return client
}

export class AiError extends Error {}

/** Overloaded / rate-limited / network: worth retrying the same model. */
class TransientError extends AiError {}
/** Model missing or not allowed on this key (404 / 403 / quota 0): move to the next model. */
class UnavailableError extends AiError {}

type JsonRequest<T> = {
  system: string
  prompt: string
  /** JSON Schema the model must follow (Gemini structured output). */
  jsonSchema: object
  /** Validated again with Zod before anything is stored (CLAUDE.md). */
  schema: ZodType<T>
}

/** One JSON-only Gemini call: structured output → JSON.parse → Zod. Throws AiError on failure. */
export async function generateJson<T>(req: JsonRequest<T>): Promise<T> {
  let lastError: unknown = null
  const deadline = Date.now() + BUDGET_MS
  for (const model of MODEL_CHAIN) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
      const remaining = deadline - Date.now()
      if (remaining < 10_000) break
      try {
        return await callOnce(model, req, Math.min(TIMEOUT_MS, remaining))
      } catch (err) {
        lastError = err
        console.warn(`gemini: ${model} attempt ${attempt + 1} failed —`, err instanceof AiError ? err.message : err)
        if (err instanceof UnavailableError) break
        // A malformed answer is retried once on the same model, then the next model.
        if (!(err instanceof TransientError) && attempt >= 1) break
        const wait = BACKOFF_MS[attempt]
        if (wait && attempt < ATTEMPTS_PER_MODEL - 1) await new Promise((r) => setTimeout(r, wait))
      }
    }
  }
  if (lastError instanceof AiError && !(lastError instanceof TransientError) && !(lastError instanceof UnavailableError)) throw lastError
  throw new AiError('The AI service is unavailable right now. Please retry in a few minutes.')
}

function classify(err: unknown): AiError {
  const message = err instanceof Error ? err.message : String(err)
  const status = (err as { status?: number } | null)?.status
  if (status === 404 || status === 403 || /not found|no longer available|permission/i.test(message)) {
    return new UnavailableError('AI model unavailable.')
  }
  if (status === 429 && /limit: 0\b/.test(message)) return new UnavailableError('AI model has no quota on this key.')
  if (status === 429 || status === 500 || status === 503 || status === 504 || status === undefined) {
    return new TransientError('The AI service is busy.')
  }
  return new AiError('The AI service rejected the request.')
}

// Error messages are stored on rows and shown to the PM, so they never carry upstream detail;
// the raw error is logged server-side instead.
async function callOnce<T>(model: string, req: JsonRequest<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let raw: string | undefined
  try {
    const response = await gemini().models.generateContent({
      model,
      contents: req.prompt,
      config: {
        systemInstruction: req.system,
        responseMimeType: 'application/json',
        responseJsonSchema: req.jsonSchema,
        temperature: 0.2,
        abortSignal: controller.signal,
      },
    })
    raw = response.text
  } catch (err) {
    if (controller.signal.aborted) throw new TransientError('The AI request timed out.')
    console.warn(`gemini: ${model} raw error —`, err instanceof Error ? err.message.slice(0, 300) : err)
    throw classify(err)
  } finally {
    clearTimeout(timer)
  }
  if (!raw) throw new AiError('The AI returned an empty response.')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new AiError('The AI returned a response that was not valid JSON.')
  }
  const result = req.schema.safeParse(parsed)
  if (!result.success) throw new AiError('The AI response did not match the expected format.')
  return result.data
}
