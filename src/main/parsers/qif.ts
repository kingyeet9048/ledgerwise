import { ParsedTransaction } from '../../shared/types'

type QIFType = 'bank' | 'ccard' | 'invst' | 'cash' | 'oth_a' | 'oth_l'

function parseQIFDate(dateStr: string): string {
  const clean = dateStr.trim()

  // MM/DD/YY or MM/DD/YYYY
  const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})[\/'](\d{2,4})$/)
  if (slashMatch) {
    const year =
      slashMatch[3].length === 2
        ? parseInt(slashMatch[3]) > 50
          ? `19${slashMatch[3]}`
          : `20${slashMatch[3]}`
        : slashMatch[3]
    return `${year}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`
  }

  // MM-DD-YYYY
  const dashMatch = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dashMatch) {
    return `${dashMatch[3]}-${dashMatch[1].padStart(2, '0')}-${dashMatch[2].padStart(2, '0')}`
  }

  // YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return clean

  return clean
}

function parseQIFAmount(amountStr: string): number {
  const clean = amountStr.replace(/[$,\s]/g, '').trim()
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

function mapQIFAction(action: string): ParsedTransaction['type'] {
  const a = action.toLowerCase()
  if (a.includes('buy') || a === 'b' || a === 'bi') return 'buy'
  if (a.includes('sell') || a === 's' || a === 'si') return 'sell'
  if (a.includes('div') || a === 'div') return 'dividend'
  if (a.includes('int') || a === 'intinc') return 'interest'
  if (a.includes('fee') || a === 'miscexp') return 'fee'
  if (a.includes('xin') || a.includes('xout') || a === 'x') return 'transfer'
  if (a.includes('cash')) return 'income'
  return 'other'
}

export function parseQIF(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = content.split(/\r?\n/)

  let accountType: QIFType = 'bank'
  let currentRecord: Record<string, string> = {}

  for (const line of lines) {
    const raw = line.trim()
    if (!raw) continue

    const indicator = raw[0]
    const value = raw.substring(1).trim()

    // Account type declaration
    if (indicator === '!') {
      const typeLower = value.toLowerCase()
      if (typeLower.includes('bank') || typeLower.includes('cash')) accountType = 'bank'
      else if (typeLower.includes('ccard')) accountType = 'ccard'
      else if (typeLower.includes('invst') || typeLower.includes('invstl')) accountType = 'invst'
      currentRecord = {}
      continue
    }

    // End of record
    if (indicator === '^') {
      const transaction = buildTransaction(currentRecord, accountType)
      if (transaction) transactions.push(transaction)
      currentRecord = {}
      continue
    }

    switch (indicator) {
      case 'D':
        currentRecord.date = value
        break
      case 'T':
        currentRecord.amount = value
        break
      case 'P':
        currentRecord.payee = value
        break
      case 'M':
        currentRecord.memo = value
        break
      case 'N':
        // Check number for bank, Action for investments
        currentRecord.action_or_check = value
        break
      case 'C':
        currentRecord.cleared = value
        break
      case 'L':
        currentRecord.category = value
        break
      case 'Y':
        currentRecord.security = value
        break
      case 'I':
        currentRecord.price = value
        break
      case 'Q':
        currentRecord.quantity = value
        break
      default:
        break
    }
  }

  // Handle last record if no trailing ^
  if (currentRecord.date) {
    const transaction = buildTransaction(currentRecord, accountType)
    if (transaction) transactions.push(transaction)
  }

  return transactions
}

function buildTransaction(
  record: Record<string, string>,
  accountType: QIFType
): ParsedTransaction | null {
  if (!record.date) return null

  const date = parseQIFDate(record.date)

  if (accountType === 'invst') {
    // Investment record
    const action = record.action_or_check || ''
    const quantity = record.quantity ? parseFloat(record.quantity) : undefined
    const price = record.price ? parseQIFAmount(record.price) : undefined
    const amount = record.amount ? parseQIFAmount(record.amount) : (quantity && price ? quantity * price : 0)

    return {
      date,
      amount: Math.abs(amount),
      payee: record.payee || record.security || '',
      memo: record.memo,
      type: mapQIFAction(action),
      security_symbol: record.security,
      quantity,
      price,
      isDuplicate: false
    }
  } else {
    // Bank/CCard record
    const rawAmount = parseQIFAmount(record.amount || '0')
    const type: ParsedTransaction['type'] = rawAmount < 0 ? 'expense' : 'income'

    return {
      date,
      amount: parseFloat(Math.abs(rawAmount).toFixed(2)),
      payee: record.payee || '',
      memo: record.memo,
      type,
      isDuplicate: false
    }
  }
}
