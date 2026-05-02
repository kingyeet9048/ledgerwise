import { ipcMain } from 'electron'
import * as fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database'
import { parseFile } from '../parsers'
import { extractPDFText } from '../parsers/pdf'
import { ParsedTransaction, ImportPreview, IpcResponse, Transaction } from '../../shared/types'
import { recalcAccountBalance } from './balance-utils'

interface ImportParseArgs {
  filePath: string
  accountId: string
  institution?: string
}

interface ImportConfirmArgs {
  sessionId: string
  accountId: string
  transactions: ParsedTransaction[]
}

export function registerImportHandlers(): void {
  // Debug helper: returns raw text extracted from a PDF
  ipcMain.handle('import:pdf-text', async (_, filePath: string): Promise<IpcResponse<string>> => {
    try {
      const buffer = fs.readFileSync(filePath)
      const text = await extractPDFText(buffer)
      return { success: true, data: text }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    'import:parse',
    async (_, args: ImportParseArgs): Promise<IpcResponse<ImportPreview>> => {
      try {
        const db = getDb()
        const { filePath, accountId, institution } = args

        const { transactions, parser } = await parseFile(filePath, institution)
        const filename = filePath.split(/[/\\]/).pop() || filePath

        // Check for duplicates
        const existingExternalIds = new Set(
          (
            db
              .prepare('SELECT external_id FROM transactions WHERE account_id = ? AND external_id IS NOT NULL')
              .all(accountId) as { external_id: string }[]
          ).map((r) => r.external_id)
        )

        let duplicateCount = 0
        const markedTransactions = transactions.map((tx) => {
          let isDuplicate = false
          if (tx.external_id && existingExternalIds.has(tx.external_id)) {
            isDuplicate = true
            duplicateCount++
          } else {
            // Check for fuzzy duplicate: same date, amount, payee within same account
            const fuzzy = db
              .prepare(
                'SELECT id FROM transactions WHERE account_id = ? AND date = ? AND ABS(amount - ?) < 0.01 AND payee = ? LIMIT 1'
              )
              .get(accountId, tx.date, tx.amount, tx.payee || '')
            if (fuzzy) {
              isDuplicate = true
              duplicateCount++
            }
          }
          return { ...tx, isDuplicate }
        })

        // Create pending import session
        const sessionId = uuidv4()
        db.prepare(`
          INSERT INTO import_sessions (id, account_id, filename, parser, row_count, imported_count, duplicate_count, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `).run(sessionId, accountId, filename, parser, transactions.length, 0, duplicateCount, new Date().toISOString())

        return {
          success: true,
          data: {
            session_id: sessionId,
            filename,
            parser,
            transactions: markedTransactions,
            duplicateCount,
            totalCount: transactions.length
          }
        }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'import:confirm',
    async (_, args: ImportConfirmArgs): Promise<IpcResponse<{ imported: number; skipped: number }>> => {
      try {
        const db = getDb()
        const { sessionId, accountId, transactions } = args

        // Apply category rules
        const rules = db
          .prepare('SELECT * FROM category_rules ORDER BY priority DESC')
          .all() as { pattern: string; category_id: string; field: string }[]

        const insertTx = db.prepare(`
          INSERT INTO transactions (
            id, account_id, date, amount, currency, payee, memo,
            category_id, type, status, external_id, is_split,
            source_file, source_parser, import_session_id,
            security_symbol, quantity, price, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'USD', ?, ?, ?, ?, 'posted', ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        const session = db
          .prepare('SELECT filename, parser FROM import_sessions WHERE id = ?')
          .get(sessionId) as { filename: string; parser: string }

        let imported = 0
        let skipped = 0

        const doImport = db.transaction(() => {
          for (const tx of transactions) {
            if (tx.isDuplicate) {
              skipped++
              continue
            }

            // Apply category rules
            let categoryId: string | null = null
            for (const rule of rules) {
              const fieldValue =
                rule.field === 'payee' ? tx.payee || '' : tx.memo || ''
              if (fieldValue.toLowerCase().includes(rule.pattern.toLowerCase())) {
                categoryId = rule.category_id
                break
              }
            }

            const id = uuidv4()
            const now = new Date().toISOString()
            insertTx.run(
              id,
              accountId,
              tx.date,
              tx.amount,
              tx.payee || null,
              tx.memo || null,
              categoryId,
              tx.type,
              tx.external_id || null,
              session?.filename || null,
              session?.parser || null,
              sessionId,
              tx.security_symbol || null,
              tx.quantity || null,
              tx.price || null,
              now,
              now
            )
            imported++
          }
        })

        doImport()

        // Update session
        db.prepare(
          'UPDATE import_sessions SET imported_count = ?, duplicate_count = ?, status = \'confirmed\' WHERE id = ?'
        ).run(imported, skipped, sessionId)

        // Recalculate account balance
        recalcAccountBalance(db, accountId)

        return { success: true, data: { imported, skipped } }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )
}

