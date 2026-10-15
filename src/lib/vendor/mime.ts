// Client-safe (no server imports): used by upload forms in the browser and by the API routes.

/** MIME type implied by a file name's extension (accepted types only; '' otherwise). */
export function mimeForExtension(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return ''
}
