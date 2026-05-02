import { ParsedTransaction } from '../../shared/types'

function extractTag(content: string, tag: string): string {
  // Handle both <TAG>value</TAG> and OFX SGML <TAG>value (no closing tag)
  const xmlMatch = content.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))
  if (xmlMatch) return xmlMatch[1].trim()

  const sgmlMatch = content.match(new RegExp(`<${tag}>([^<\r\n]+)`, 'i'))
  if (sgmlMatch) return sgmlMatch[1].trim()

  return ''
}

function extractAllBlocks(content: string, tag: string): string[] {
  const blocks: string[] = []
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi')
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[1])
  }

  if (blocks.length === 0) {
    // SGML format - split on tag
    const parts = content.split(new RegExp(`<${tag}>`, 'i'))
    for (let i = 1; i < parts.length; i++) {
      // Take until next block-level tag
      const part = parts[i].split(/<\s*\/?\s*[A-Z]+\s*>/)[0]
      blocks.push(parts[i])
    }
  }

  return blocks
}

function ofxDateToISO(ofxDate: string): string {
  // OFX date format: YYYYMMDD or YYYYMMDDHHMMSS
  const clean = ofxDate.replace(/\[.*\]/, '').trim()
  if (clean.length >= 8) {
    const year = clean.substring(0, 4)
    const month = clean.substring(4, 6)
    const day = clean.substring(6, 8)
    return `${year}-${month}-${day}`
  }
  return clean
}

function mapOFXType(trntype: string): ParsedTransaction['type'] {
  const t = trntype.toUpperCase()
  switch (t) {
    case 'CREDIT':
    case 'DEP':
    case 'DIRECTDEP':
      return 'income'
    case 'DEBIT':
    case 'PAYMENT':
    case 'CHECK':
    case 'CASH':
      return 'expense'
    case 'INT':
      return 'interest'
    case 'DIV':
      return 'dividend'
    case 'FEE':
    case 'SRVCHG':
      return 'fee'
    case 'XFER':
      return 'transfer'
    case 'ATM':
      return 'expense'
    default:
      return 'other'
  }
}

export function parseOFX(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []

  // Find BANKTRANLIST or investment transactions
  const tranListMatch = content.match(/<BANKTRANLIST>([\s\S]*?)<\/BANKTRANLIST>/i)
  const tranContent = tranListMatch ? tranListMatch[1] : content

  // Extract all STMTTRN blocks
  const stmtBlocks = extractAllBlocks(tranContent, 'STMTTRN')

  if (stmtBlocks.length === 0) {
    // Try SGML format: split on <STMTTRN>
    const sgmlParts = content.split(/<STMTTRN>/i)
    for (let i = 1; i < sgmlParts.length; i++) {
      stmtBlocks.push(sgmlParts[i])
    }
  }

  for (const block of stmtBlocks) {
    const trntype = extractTag(block, 'TRNTYPE')
    const dtposted = extractTag(block, 'DTPOSTED')
    const trnamt = extractTag(block, 'TRNAMT')
    const fitid = extractTag(block, 'FITID')
    const name = extractTag(block, 'NAME')
    const memo = extractTag(block, 'MEMO')

    if (!dtposted || !trnamt) continue

    const rawAmount = parseFloat(trnamt)
    if (isNaN(rawAmount)) continue

    const date = ofxDateToISO(dtposted)

    // Prefer TRNTYPE for classification; fall back to sign when type is unknown
    let type = mapOFXType(trntype)
    if (type === 'other') {
      type = rawAmount < 0 ? 'expense' : 'income'
    }

    transactions.push({
      date,
      amount: parseFloat(Math.abs(rawAmount).toFixed(2)),
      payee: name,
      memo,
      type,
      external_id: fitid || undefined,
      isDuplicate: false
    })
  }

  return transactions
}
