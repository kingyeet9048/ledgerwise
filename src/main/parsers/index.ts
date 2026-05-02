import * as fs from 'fs'
import * as path from 'path'
import { ParsedTransaction } from '../../shared/types'
import { parseCSV } from './csv'
import { parseOFX } from './ofx'
import { parseQIF } from './qif'
import { parseChasePDF } from './pdf'

export type ParserType = 'csv' | 'ofx' | 'qfx' | 'qif' | 'pdf' | 'unknown'

export function detectParser(filePath: string): ParserType {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.csv':
      return 'csv'
    case '.ofx':
      return 'ofx'
    case '.qfx':
      return 'qfx'
    case '.qif':
      return 'qif'
    case '.pdf':
      return 'pdf'
    default:
      return 'unknown'
  }
}

export async function parseFile(
  filePath: string,
  institutionName?: string
): Promise<{ transactions: ParsedTransaction[]; parser: ParserType }> {
  const parserType = detectParser(filePath)

  // PDF requires binary buffer; all others are text
  if (parserType === 'pdf') {
    const buffer = fs.readFileSync(filePath)
    const transactions = await parseChasePDF(buffer)
    return { transactions, parser: 'pdf' }
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  let transactions: ParsedTransaction[] = []

  switch (parserType) {
    case 'csv':
      transactions = parseCSV(content, institutionName)
      break
    case 'ofx':
    case 'qfx':
      transactions = parseOFX(content)
      break
    case 'qif':
      transactions = parseQIF(content)
      break
    default:
      // Try CSV as fallback
      try {
        transactions = parseCSV(content, institutionName)
      } catch {
        throw new Error(`Unsupported file format: ${path.extname(filePath)}`)
      }
  }

  return { transactions, parser: parserType }
}
