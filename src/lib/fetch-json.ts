// Client-side helper for our Route Handlers. Errors follow the CLAUDE.md shape
// { error, code } plus optional per-field messages from validation.
export type ApiFailure = { error: string; code: string; fields?: Record<string, string[] | undefined> }

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: ApiFailure) {
    super(body.error)
  }
}

export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  // FormData sets its own multipart boundary; everything else is JSON.
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const res = await fetch(input, { ...init, headers })
  const body: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const failure = body as Partial<ApiFailure>
    throw new ApiError(res.status, {
      error: failure.error ?? 'Something went wrong. Please try again.',
      code: failure.code ?? 'unknown_error',
      ...(failure.fields ? { fields: failure.fields } : {}),
    })
  }
  return body as T
}
