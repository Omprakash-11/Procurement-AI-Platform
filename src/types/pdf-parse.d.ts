// pdf-parse 1.1.1's package entry runs a self-test when imported without a parent module
// (as in bundled code), so the library file is imported directly. Minimal typings for it.
declare module 'pdf-parse/lib/pdf-parse.js' {
  type PdfParseResult = { numpages: number; text: string; info: unknown; metadata: unknown }
  export default function pdfParse(data: Buffer, options?: { max?: number }): Promise<PdfParseResult>
}
