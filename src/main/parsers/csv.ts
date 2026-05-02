import { parse } from 'csv-parse/sync'
import { ParsedTransaction } from '../../shared/types'

interface ColumnMapping {
  csvHeader: string
  field: string
  transform?: (value: string) => unknown
}

interface InstitutionTemplate {
  name: string
  institution: string
  columns: ColumnMapping[]
  dateFormat?: string
  amountSign?: 1 | -1
  skipRows?: number
}

function parseDate(value: string): string {
  // Try multiple date formats
  const clean = value.trim()

  // MM/DD/YYYY
  const mdyMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdyMatch) {
    return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`
  }

  // YYYY-MM-DD
  const isodateMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isodateMatch) {
    return `${isodateMatch[1]}-${isodateMatch[2]}-${isodateMatch[3]}`
  }

  // MM-DD-YYYY
  const mdyDashMatch = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (mdyDashMatch) {
    return `${mdyDashMatch[3]}-${mdyDashMatch[1].padStart(2, '0')}-${mdyDashMatch[2].padStart(2, '0')}`
  }

  // YYYYMMDD
  const compactMatch = clean.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compactMatch) {
    return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`
  }

  return clean
}

function parseAmount(value: string): number {
  const clean = value.replace(/[$,\s]/g, '').trim()
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

export const institutionTemplates: InstitutionTemplate[] = [
  {
    name: 'Chase Checking/Savings',
    institution: 'chase',
    columns: [
      { csvHeader: 'Details', field: 'memo' },
      { csvHeader: 'Posting Date', field: 'date', transform: (v) => parseDate(v) },
      { csvHeader: 'Description', field: 'payee' },
      { csvHeader: 'Amount', field: 'amount', transform: (v) => parseAmount(v) },
      { csvHeader: 'Type', field: 'type' },
      { csvHeader: 'Balance', field: 'balance' },
      { csvHeader: 'Check or Slip #', field: 'memo2' }
    ],
    amountSign: 1
  },
  {
    name: 'Chase Credit Card',
    institution: 'chase_credit',
    columns: [
      { csvHeader: 'Transaction Date', field: 'date', transform: (v) => parseDate(v) },
      { csvHeader: 'Post Date', field: 'post_date' },
      { csvHeader: 'Description', field: 'payee' },
      { csvHeader: 'Category', field: 'category' },
      { csvHeader: 'Type', field: 'type' },
      { csvHeader: 'Amount', field: 'amount', transform: (v) => parseAmount(v) },
      { csvHeader: 'Memo', field: 'memo' }
    ],
    amountSign: -1
  },
  {
    name: 'Wells Fargo',
    institution: 'wells_fargo',
    columns: [
      { csvHeader: '0', field: 'date', transform: (v) => parseDate(v) },
      { csvHeader: '1', field: 'amount', transform: (v) => parseAmount(v) },
      { csvHeader: '2', field: '_skip' },
      { csvHeader: '3', field: '_skip' },
      { csvHeader: '4', field: 'payee' }
    ],
    amountSign: 1
  },
  {
    name: 'Robinhood',
    institution: 'robinhood',
    columns: [
      { csvHeader: 'Activity Date', field: 'date', transform: (v) => parseDate(v) },
      { csvHeader: 'Process Date', field: 'process_date' },
      { csvHeader: 'Settle Date', field: 'settle_date' },
      { csvHeader: 'Instrument', field: 'security_symbol' },
      { csvHeader: 'Description', field: 'payee' },
      { csvHeader: 'Trans Code', field: 'trans_code' },
      { csvHeader: 'Quantity', field: 'quantity', transform: (v) => parseFloat(v) || 0 },
      { csvHeader: 'Price', field: 'price', transform: (v) => parseAmount(v) },
      { csvHeader: 'Amount', field: 'amount', transform: (v) => parseAmount(v) }
    ],
    amountSign: 1
  },
  {
    name: 'Vanguard',
    institution: 'vanguard',
    columns: [
      { csvHeader: 'TradeDate', field: 'date', transform: (v) => parseDate(v) },
      { csvHeader: 'SettleDate', field: 'settle_date' },
      { csvHeader: 'TransactionType', field: 'trans_type' },
      { csvHeader: 'TransactionDescription', field: 'payee' },
      { csvHeader: 'InvestmentName', field: 'name' },
      { csvHeader: 'Symbol', field: 'security_symbol' },
      { csvHeader: 'Shares', field: 'quantity', transform: (v) => parseFloat(v) || 0 },
      { csvHeader: 'SharePrice', field: 'price', transform: (v) => parseAmount(v) },
      { csvHeader: 'PrincipalAmount', field: 'principal' },
      { csvHeader: 'CommissionsAndFees', field: 'fees' },
      { csvHeader: 'NetAmount', field: 'amount', transform: (v) => parseAmount(v) }
    ],
    amountSign: 1
  }
]

function detectTemplate(headers: string[]): InstitutionTemplate | null {
  const headerSet = new Set(headers.map((h) => h.trim().toLowerCase()))

  // Chase Credit
  if (headerSet.has('transaction date') && headerSet.has('post date') && headerSet.has('description')) {
    return institutionTemplates.find((t) => t.institution === 'chase_credit') || null
  }

  // Chase Checking
  if (headerSet.has('posting date') && headerSet.has('details') && headerSet.has('description')) {
    return institutionTemplates.find((t) => t.institution === 'chase') || null
  }

  // Robinhood
  if (headerSet.has('activity date') && headerSet.has('trans code') && headerSet.has('instrument')) {
    return institutionTemplates.find((t) => t.institution === 'robinhood') || null
  }

  // Vanguard
  if (headerSet.has('tradedate') && (headerSet.has('settlementdate') || headerSet.has('settledate'))) {
    return institutionTemplates.find((t) => t.institution === 'vanguard') || null
  }

  return null
}

function mapTransactionType(
  raw: Partial<{ type: string; trans_code: string; trans_type: string; amount: number }>
): ParsedTransaction['type'] {
  const type = (raw.type || raw.trans_code || raw.trans_type || '').toLowerCase()

  if (['buy', 'mkt buy', 'limit buy', 'reinvestment'].some((t) => type.includes(t))) return 'buy'
  if (['sell', 'mkt sell', 'limit sell'].some((t) => type.includes(t))) return 'sell'
  if (type.includes('dividend') || type.includes('div')) return 'dividend'
  if (type.includes('fee') || type.includes('commission')) return 'fee'
  if (type.includes('interest')) return 'interest'
  if (type.includes('transfer')) return 'transfer'
  if (type.includes('debit') || type.includes('payment') || type.includes('withdrawal')) return 'expense'
  if (type.includes('credit') || type.includes('deposit')) return 'income'

  // Fallback: use sign of amount
  if (typeof raw.amount === 'number') {
    return raw.amount < 0 ? 'expense' : 'income'
  }

  return 'other'
}

export function parseCSV(
  content: string,
  institutionName?: string
): ParsedTransaction[] {
  let records: Record<string, string>[]
  let template: InstitutionTemplate | null = null

  // Try parsing with headers
  try {
    records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    }) as Record<string, string>[]
  } catch {
    // Try without headers (Wells Fargo style)
    const rawRecords = parse(content, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    }) as string[][]
    records = rawRecords.map((row) =>
      row.reduce(
        (acc, val, idx) => {
          acc[String(idx)] = val
          return acc
        },
        {} as Record<string, string>
      )
    )
  }

  if (records.length === 0) return []

  const headers = Object.keys(records[0])

  // Find template
  if (institutionName) {
    template = institutionTemplates.find((t) => t.institution === institutionName) || null
  }

  if (!template) {
    template = detectTemplate(headers)
  }

  const transactions: ParsedTransaction[] = []

  for (const record of records) {
    const mapped: Record<string, unknown> = {}

    if (template) {
      // Map using template
      for (const col of template.columns) {
        const value = record[col.csvHeader]
        if (value !== undefined && col.field !== '_skip') {
          mapped[col.field] = col.transform ? col.transform(value) : value
        }
      }
    } else {
      // Generic detection
      for (const [key, value] of Object.entries(record)) {
        const keyLower = key.toLowerCase()
        if (keyLower.includes('date')) {
          mapped['date'] = mapped['date'] || parseDate(value)
        } else if (keyLower.includes('amount') || keyLower === 'debit' || keyLower === 'credit') {
          if (!mapped['amount']) mapped['amount'] = parseAmount(value)
        } else if (
          keyLower.includes('description') ||
          keyLower.includes('payee') ||
          keyLower.includes('merchant') ||
          keyLower.includes('name')
        ) {
          mapped['payee'] = mapped['payee'] || value
        } else if (keyLower.includes('memo') || keyLower.includes('note')) {
          mapped['memo'] = value
        }
      }
    }

    const date = (mapped.date as string) || new Date().toISOString().split('T')[0]
    const amount = (mapped.amount as number) || 0
    const payee = (mapped.payee as string) || ''
    const memo = (mapped.memo as string) || ''
    const security_symbol = (mapped.security_symbol as string) || undefined
    const quantity = (mapped.quantity as number) || undefined
    const price = (mapped.price as number) || undefined

    if (!date || amount === 0) continue

    const typeInput = {
      type: mapped.type as string,
      trans_code: mapped.trans_code as string,
      trans_type: mapped.trans_type as string,
      amount
    }

    const txType = mapTransactionType(typeInput)

    transactions.push({
      date,
      amount,
      payee,
      memo,
      type: txType,
      external_id: undefined,
      security_symbol,
      quantity,
      price,
      isDuplicate: false
    })
  }

  return transactions
}
