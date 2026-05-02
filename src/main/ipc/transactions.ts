import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database'
import { Transaction, IpcResponse, TransactionFilter } from '../../shared/types'
import { recalcAccountBalance } from './balance-utils'

export function registerTransactionHandlers(): void {
  ipcMain.handle(
    'transactions:list',
    async (_, filter: TransactionFilter = {}): Promise<IpcResponse<Transaction[]>> => {
      try {
        const db = getDb()
        const conditions: string[] = []
        const params: unknown[] = []

        if (filter.accountId) {
          conditions.push('t.account_id = ?')
          params.push(filter.accountId)
        }
        if (filter.categoryId) {
          conditions.push('t.category_id = ?')
          params.push(filter.categoryId)
        }
        if (filter.startDate) {
          conditions.push('t.date >= ?')
          params.push(filter.startDate)
        }
        if (filter.endDate) {
          conditions.push('t.date <= ?')
          params.push(filter.endDate)
        }
        if (filter.status) {
          conditions.push('t.status = ?')
          params.push(filter.status)
        }
        if (filter.type) {
          conditions.push('t.type = ?')
          params.push(filter.type)
        }
        if (filter.search) {
          conditions.push('(t.payee LIKE ? OR t.memo LIKE ? OR t.notes LIKE ?)')
          const searchPattern = `%${filter.search}%`
          params.push(searchPattern, searchPattern, searchPattern)
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const limitVal = filter.limit ? Math.max(1, Math.floor(Number(filter.limit))) : 500
        const offsetVal = filter.offset ? Math.max(0, Math.floor(Number(filter.offset))) : 0
        const limit = `LIMIT ${limitVal}`
        const offset = offsetVal > 0 ? `OFFSET ${offsetVal}` : ''

        const sql = `
          SELECT t.*, c.name as category_name, a.name as account_name
          FROM transactions t
          LEFT JOIN categories c ON t.category_id = c.id
          LEFT JOIN accounts a ON t.account_id = a.id
          ${where}
          ORDER BY t.date DESC, t.created_at DESC
          ${limit} ${offset}
        `

        const transactions = db.prepare(sql).all(...params) as Transaction[]
        return { success: true, data: transactions }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'transactions:create',
    async (_, tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<IpcResponse<Transaction>> => {
      try {
        const db = getDb()
        const now = new Date().toISOString()
        const id = uuidv4()

        db.prepare(`
          INSERT INTO transactions (
            id, account_id, date, amount, currency, payee, memo,
            category_id, type, status, external_id, transfer_id,
            is_split, tags, notes, source_file, source_parser,
            import_session_id, security_symbol, quantity, price,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          tx.account_id,
          tx.date,
          tx.amount,
          tx.currency || 'USD',
          tx.payee || null,
          tx.memo || null,
          tx.category_id || null,
          tx.type,
          tx.status || 'pending',
          tx.external_id || null,
          tx.transfer_id || null,
          tx.is_split || 0,
          tx.tags || null,
          tx.notes || null,
          tx.source_file || null,
          tx.source_parser || null,
          tx.import_session_id || null,
          tx.security_symbol || null,
          tx.quantity || null,
          tx.price || null,
          now,
          now
        )

        // Update account balance
        recalcAccountBalance(db, tx.account_id)

        const created = db
          .prepare('SELECT * FROM transactions WHERE id = ?')
          .get(id) as Transaction
        return { success: true, data: created }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'transactions:update',
    async (_, id: string, updates: Partial<Transaction>): Promise<IpcResponse<Transaction>> => {
      try {
        const db = getDb()
        const now = new Date().toISOString()
        const allowedFields = [
          'date', 'amount', 'payee', 'memo', 'category_id', 'type',
          'status', 'tags', 'notes', 'transfer_id', 'security_symbol',
          'quantity', 'price'
        ]

        const fields = Object.keys(updates)
          .filter((k) => allowedFields.includes(k))
          .map((k) => `${k} = ?`)
          .join(', ')

        const values = Object.keys(updates)
          .filter((k) => allowedFields.includes(k))
          .map((k) => (updates as Record<string, unknown>)[k])

        if (fields) {
          db.prepare(`UPDATE transactions SET ${fields}, updated_at = ? WHERE id = ?`).run(
            ...values,
            now,
            id
          )
        }

        const updated = db
          .prepare('SELECT * FROM transactions WHERE id = ?')
          .get(id) as Transaction

        if (updated) recalcAccountBalance(db, updated.account_id)

        return { success: true, data: updated }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle('transactions:delete', async (_, id: string): Promise<IpcResponse<boolean>> => {
    try {
      const db = getDb()
      const tx = db
        .prepare('SELECT account_id FROM transactions WHERE id = ?')
        .get(id) as { account_id: string }
      db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
      if (tx) recalcAccountBalance(db, tx.account_id)
      return { success: true, data: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    'transactions:bulk-review',
    async (_, ids: string[]): Promise<IpcResponse<number>> => {
      try {
        const db = getDb()
        const now = new Date().toISOString()
        const stmt = db.prepare(
          "UPDATE transactions SET status = 'reviewed', updated_at = ? WHERE id = ?"
        )
        const bulkUpdate = db.transaction((txIds: string[]) => {
          for (const txId of txIds) {
            stmt.run(now, txId)
          }
        })
        bulkUpdate(ids)
        return { success: true, data: ids.length }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )
}

