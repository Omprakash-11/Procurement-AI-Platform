import mammoth from 'mammoth'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import * as XLSX from 'xlsx'

import type { Enums } from '@/types'

// Tech Stack §5.3 / §6: extract text server-side first (never Gemini's file upload API).
// OCR is out of scope — an empty result means a scanned document.

export const SCANNED_MESSAGE =
  'This document appears to be a scanned image. Text extraction is not supported for scanned files in this version.'

// Keep well inside the models' 1M-token input (≈ 4 chars per token), leaving room for prompts.
const MAX_CHARS = 2_000_000

export class ScannedDocumentError extends Error {
  constructor() {
    super(SCANNED_MESSAGE)
  }
}

export async function extractText(buffer: Buffer, type: Enums<'document_type'>): Promise<string> {
  let text = ''
  if (type === 'pdf') {
    text = (await pdfParse(buffer)).text
  } else if (type === 'docx') {
    text = (await mammoth.extractRawText({ buffer })).value
  } else {
    // SheetJS 0.20.3 (P7-3). Formulas / HTML are not evaluated; every sheet as CSV.
    const workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: false, cellHTML: false })
    text = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name]
      return sheet ? `## Sheet: ${name}\n${XLSX.utils.sheet_to_csv(sheet)}` : ''
    }).join('\n\n')
  }

  const cleaned = text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim()
  if (cleaned.replace(/[\s,]/g, '').length === 0) throw new ScannedDocumentError()
  return cleaned.length > MAX_CHARS ? cleaned.slice(0, MAX_CHARS) : cleaned
}
