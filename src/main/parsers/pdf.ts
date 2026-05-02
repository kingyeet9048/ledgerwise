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
// Core parser — exported for unit testing
// ---------------------------------------------------------------------------

export function extractChaseTransactions(rawText: string): ParsedTransaction[] {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // ── Determine year + closing month ───────────────────────────────────────
  let year = new Date().getFullYear()
  let closingMonth = 12

  const ocMatch = text.match(
    /Opening\/Closing Date\s*(\d{2})\/\d{2}\/(\d{2,4})\s*-\s*(\d{2})\/\d{2}\/(\d{2,4})/i
  )
  if (ocMatch) {
    const y = parseInt(ocMatch[4])
    year = y < 100 ? 2000 + y : y
    closingMonth = parseInt(ocMatch[3])
  } else {
    const sdMatch = text.match(/Statement Date[:\s]*(\d{2})\/(\d{2})\/(\d{2,4})/i)
    if (sdMatch) {
      const y = parseInt(sdMatch[3])
      year = y < 100 ? 2000 + y : y
      closingMonth = parseInt(sdMatch[1])
    }
  }

  // ── Find ACCOUNT ACTIVITY and cut off at totals section ──────────────────
  const acctIdx = text.search(/ACCOUNT ACTIVITY/i)
  const workText = acctIdx !== -1 ? text.slice(acctIdx) : text

  const stopIdx = workText.search(/Total fees charged in \d{4}|INTEREST CHARGES/i)
  const txText = stopIdx !== -1 ? workText.slice(0, stopIdx) : workText

  const results: ParsedTransaction[] = []

  // ── Strategy A: line-by-line ──────────────────────────────────────────────
  // Chase format: "MM/DD DESCRIPTION AMOUNT" (spaces), or occasionally no spaces
  const linePatterns = [
    /^(\d{2}\/\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/, // spaces
    /^(\d{2}\/\d{2})(.+?)(-?\d[\d,]*\.\d{2})\s*$/ // no spaces (pdf-parse quirk)
  ]

  const lines = txText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  for (const line of lines) {
    if (shouldSkipLine(line)) continue
    if (isStopLine(line)) continue

    for (const pat of linePatterns) {
      const m = line.match(pat)
      if (!m) continue
      const tx = buildTransaction(m[1], m[2], m[3], year, closingMonth)
      if (tx) {
        results.push(tx)
        break
      }
    }
  }

  if (results.length > 0) return dedup(results)

  // ── Strategy B: global scan (handles text across line boundaries) ─────────
  const globalPat = /(\d{2}\/\d{2})\s*([\s\S]+?)(-?\d[\d,]*\.\d{2})(?=\n|\d{2}\/\d{2}|$)/gm
  let gm: RegExpExecArray | null
  while ((gm = globalPat.exec(txText)) !== null) {
    const raw = gm[2].replace(/\n/g, ' ').trim()
    if (!raw || shouldSkipLine(raw)) continue
    const tx = buildTransaction(gm[1], raw, gm[3], year, closingMonth)
    if (tx) results.push(tx)
  }

  return dedup(results)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SKIP_RE =
  /^(PAYMENTS AND OTHER CREDITS|PURCHASE|ACCOUNT ACTIVITY|INTEREST CHARGES|Date of|Merchant Name|Balance Type|PURCHASES|CASH ADVANCES|BALANCE TRANSFERS|MY CHASE LOAN|Manage your|Customer Service|Download the|Make your|www\.|chase\.com|P\.O\. BOX|Page \d+|Statement Date|Opening\/Closing|Credit Limit|Available|Cash Access|Previous|New Balance|Past Due|Balance over|Payment Due|Total points|Start redeem|You earn|Congratulations|Annual Percentage|\(v\)|\(d\)|\(a\)|Please see|We add trans|Your due date|If you|In your|You must|While we|The charge|We can|After we)/i

function shouldSkipLine(line: string): boolean {
  return SKIP_RE.test(line) || line.length < 5
}

const STOP_RE =
  /^(Total fees|Total interest|Year-to-date|Annual Percentage Rate|31 Days in Billing|\(v\) =)/i

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

  // Chase credit card statements: negative = payment/credit (income), positive = purchase (expense)
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
