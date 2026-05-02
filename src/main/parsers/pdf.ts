import { ParsedTransaction } from '../../shared/types'

// Import the internal module directly to avoid pdf-parse's top-level test-file
// read side-effect, which throws in Electron's main process.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse/lib/pdf-parse') as (buf: Buffer) => Promise<{ text: string }>

export async function parseChasePDF(buffer: Buffer): Promise<ParsedTransaction[]> {
  const data = await pdfParse(buffer)
  return extractChaseTransactions(data.text)
}

function extractChaseTransactions(text: string): ParsedTransaction[] {
  // Determine the statement year from "Statement Date: MM/DD/YY" or closing date
  let year = new Date().getFullYear()
  const yearMatch =
    text.match(/Statement Date[:\s]+\d{2}\/\d{2}\/(\d{2,4})/i) ||
    text.match(/Opening\/Closing Date[:\s]+\d{2}\/\d{2}\/(\d{2,4})\s*-\s*\d{2}\/\d{2}\/(\d{2,4})/i)
  if (yearMatch) {
    // Prefer last capture group (closing date year)
    const raw = yearMatch[2] ?? yearMatch[1]
    const y = parseInt(raw)
    year = y < 100 ? 2000 + y : y
  }

  // Extract the closing month for year-boundary detection (Dec→Jan wrap)
  let closingMonth = 12
  const closingMatch = text.match(
    /Opening\/Closing Date[:\s]+\d{2}\/\d{2}\/\d{2,4}\s*-\s*(\d{2})\/\d{2}/i
  )
  if (closingMatch) closingMonth = parseInt(closingMatch[1])

  // Locate the ACCOUNT ACTIVITY section — transactions only appear after this header
  const activityIdx = text.search(/ACCOUNT ACTIVITY/i)
  if (activityIdx === -1) return []
  const activityText = text.slice(activityIdx)

  const lines = activityText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const transactions: ParsedTransaction[] = []

  // Section-level skip markers
  const SKIP_PATTERN =
    /^(PAYMENTS AND OTHER CREDITS|PURCHASE|ACCOUNT ACTIVITY|INTEREST CHARGES|Date of|Merchant Name|Balance Type|PURCHASES|CASH ADVANCES|BALANCE TRANSFERS)/i
  const STOP_PATTERN =
    /^(Total fees|Total interest|Year-to-date|Annual Percentage|31 Days in Billing|\(v\) =)/i

  for (const line of lines) {
    if (STOP_PATTERN.test(line)) break
    if (SKIP_PATTERN.test(line)) continue

    // Match: MM/DD  <description …>  <amount>
    // The amount may be negative (credits/payments) or positive (purchases)
    // We allow 1+ spaces before the amount since pdf-parse may vary spacing
    const match =
      line.match(/^(\d{2}\/\d{2})\s{1,}(.+?)\s{2,}(-?[\d,]+\.\d{2})\s*$/) ??
      line.match(/^(\d{2}\/\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/)

    if (!match) continue

    const [, dateStr, rawPayee, amountStr] = match
    const [monthStr, dayStr] = dateStr.split('/')
    const month = parseInt(monthStr)
    const amount = parseFloat(amountStr.replace(/,/g, ''))

    // Handle year boundary: if transaction month is significantly later than
    // the closing month it belongs to the prior year (e.g. Dec closing, Jan txn)
    const txYear = month > closingMonth + 1 ? year - 1 : year
    const date = `${txYear}-${monthStr}-${dayStr}`

    // Normalise payee: strip trailing state abbreviations like "AUSTIN TX"
    const payee = rawPayee.replace(/\s+[A-Z]{2}\s*$/, '').trim()

    // Sign convention from Chase PDFs:
    //   negative = payment / credit (money coming back to card)
    //   positive = purchase / charge
    const type: ParsedTransaction['type'] = amount < 0 ? 'income' : 'expense'

    transactions.push({
      date,
      amount: parseFloat(Math.abs(amount).toFixed(2)),
      payee,
      memo: rawPayee !== payee ? rawPayee : undefined,
      type
    })
  }

  return transactions
}
