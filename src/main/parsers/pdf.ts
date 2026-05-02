import { ParsedTransaction } from '../../shared/types'

// Use the internal module directly to skip pdf-parse's top-level test-file read.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse/lib/pdf-parse') as (buf: Buffer) => Promise<{ text: string }>

export async function parseChasePDF(buffer: Buffer): Promise<ParsedTransaction[]> {
  const data = await pdfParse(buffer)
  return extractChaseTransactions(data.text)
}

/** Returns the raw text extracted from a PDF — used for debugging. */
export async function extractPDFText(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer)
  return data.text
}

// ---------------------------------------------------------------------------
// Core parser
// ---------------------------------------------------------------------------

function extractChaseTransactions(rawText: string): ParsedTransaction[] {
  // Normalise line endings
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // ── Determine statement year ──────────────────────────────────────────────
  let year = new Date().getFullYear()
  let closingMonth = 12

  // "Opening/Closing Date 03/08/26 - 04/07/26"  →  year=2026, closingMonth=4
  const ocMatch = text.match(
    /Opening\/Closing Date\s+(\d{2})\/\d{2}\/(\d{2,4})\s*-\s*(\d{2})\/\d{2}\/(\d{2,4})/i
  )
  if (ocMatch) {
    const y = parseInt(ocMatch[4])
    year = y < 100 ? 2000 + y : y
    closingMonth = parseInt(ocMatch[3])
  } else {
    // Fallback: "Statement Date: 04/07/26" on a page footer
    const sdMatch = text.match(/Statement Date[:\s]+(\d{2})\/(\d{2})\/(\d{2,4})/i)
    if (sdMatch) {
      const y = parseInt(sdMatch[3])
      year = y < 100 ? 2000 + y : y
      closingMonth = parseInt(sdMatch[1])
    }
  }

  // ── Build a clean line list ───────────────────────────────────────────────
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  // ── Strategy 1: single-line match "MM/DD  <payee>  <amount>" ─────────────
  // Try progressively looser patterns in order.
  const singleLinePatterns = [
    // Two or more spaces before amount (preferred — reduces false positives)
    /^(\d{2}\/\d{2})\s{2,}(.+?)\s{2,}(-?[\d,]+\.\d{2})\s*$/,
    // One or more spaces (looser)
    /^(\d{2}\/\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/,
  ]

  const results: ParsedTransaction[] = []

  for (const line of lines) {
    if (shouldSkipLine(line)) continue
    if (isStopLine(line)) break

    for (const pat of singleLinePatterns) {
      const m = line.match(pat)
      if (m) {
        const tx = buildTransaction(m[1], m[2], m[3], year, closingMonth)
        if (tx) results.push(tx)
        break
      }
    }
  }

  if (results.length > 0) return results

  // ── Strategy 2: global regex across entire text ───────────────────────────
  // Handles PDFs where pdf-parse joins adjacent column text without newlines.
  const globalPat = /\b(\d{2}\/\d{2})\s{1,8}([A-Z][^\n]{3,60}?)\s{1,8}(-?[\d,]{1,10}\.\d{2})\b/gm
  let gm: RegExpExecArray | null
  while ((gm = globalPat.exec(text)) !== null) {
    const payeeCandidate = gm[2].trim()
    if (shouldSkipLine(payeeCandidate)) continue
    const tx = buildTransaction(gm[1], payeeCandidate, gm[3], year, closingMonth)
    if (tx) results.push(tx)
  }

  if (results.length > 0) return dedup(results)

  // ── Strategy 3: multi-line — date on one line, amount nearby ─────────────
  // Some PDFs extract columns separately: dates stacked, then descriptions,
  // then amounts. We reconstruct by pairing dates with the next amount found.
  const dateLines: { idx: number; dateStr: string }[] = []
  const amountLines: { idx: number; amount: number }[] = []
  const payeeLines: { idx: number; text: string }[] = []

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (/^\d{2}\/\d{2}$/.test(l)) dateLines.push({ idx: i, dateStr: l })
    else if (/^-?[\d,]+\.\d{2}$/.test(l)) amountLines.push({ idx: i, amount: parseFloat(l.replace(/,/g, '')) })
    else if (l.length > 2 && !shouldSkipLine(l)) payeeLines.push({ idx: i, text: l })
  }

  if (dateLines.length > 0 && amountLines.length > 0) {
    for (let d = 0; d < dateLines.length; d++) {
      const dLine = dateLines[d]
      // Find nearest amount after this date (before next date)
      const nextDateIdx = dateLines[d + 1]?.idx ?? lines.length
      const amt = amountLines.find((a) => a.idx > dLine.idx && a.idx < nextDateIdx)
      if (!amt) continue
      // Find nearest payee between date and amount
      const payeeLine = payeeLines.find((p) => p.idx > dLine.idx && p.idx < amt.idx)
      const payeeText = payeeLine?.text ?? ''
      const tx = buildTransaction(dLine.dateStr, payeeText, String(amt.amount), year, closingMonth)
      if (tx) results.push(tx)
    }
    if (results.length > 0) return dedup(results)
  }

  return []
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SKIP_RE =
  /^(PAYMENTS AND OTHER CREDITS|PURCHASE|ACCOUNT ACTIVITY|INTEREST CHARGES|Date of|Merchant Name|Balance Type|PURCHASES|CASH ADVANCES|BALANCE TRANSFERS|MY CHASE LOAN|Manage your|Customer Service|Download the|Make your|www\.|chase\.com|P\.O\. BOX|SULAIMAN|Page \d+|Statement Date|Opening\/Closing|Credit Limit|Available|Cash Access|Previous|New Balance|Past Due|Balance over|Payment Due|Total points|Start redeem|You earn|Congratulations|Annual Percentage|\(v\)|\(d\)|\(a\)|Please see|We add trans|Your due date|If you|In your|You must|While we|The charge|We can|After we)/i

function shouldSkipLine(line: string): boolean {
  return SKIP_RE.test(line) || line.length < 5
}

const STOP_RE = /^(Total fees|Total interest|Year-to-date|Annual Percentage Rate|31 Days in Billing|\(v\) =)/i

function isStopLine(line: string): boolean {
  return STOP_RE.test(line)
}

function buildTransaction(
  dateStr: string,
  rawPayee: string,
  amountStr: string,
  year: number,
  closingMonth: number
): ParsedTransaction | null {
  const parts = dateStr.split('/')
  if (parts.length !== 2) return null
  const [monthStr, dayStr] = parts
  const month = parseInt(monthStr)
  const day = parseInt(dayStr)

  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const amount = parseFloat(amountStr.replace(/,/g, ''))
  if (isNaN(amount) || Math.abs(amount) < 0.01) return null

  // Strip trailing 2-letter state code (e.g. "AUSTIN TX")
  const payee = rawPayee.replace(/\s+[A-Z]{2}\s*$/, '').trim()
  if (payee.length < 2) return null

  // Year boundary: if transaction month is later than closing month it's prior year
  const txYear = month > closingMonth + 1 ? year - 1 : year
  const date = `${txYear}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}`

  const type: ParsedTransaction['type'] = amount < 0 ? 'income' : 'expense'

  return {
    date,
    amount: parseFloat(Math.abs(amount).toFixed(2)),
    payee,
    memo: rawPayee.trim() !== payee ? rawPayee.trim() : undefined,
    type
  }
}

function dedup(txs: ParsedTransaction[]): ParsedTransaction[] {
  const seen = new Set<string>()
  return txs.filter((t) => {
    const key = `${t.date}|${t.payee}|${t.amount}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
