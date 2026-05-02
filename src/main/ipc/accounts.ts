import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database'
import { Account, IpcResponse } from '../../shared/types'

export function registerAccountHandlers(): void {
  ipcMain.handle('accounts:list', async (): Promise<IpcResponse<Account[]>> => {
    try {
      const db = getDb()
      const accounts = db
        .prepare('SELECT * FROM accounts WHERE is_closed = 0 ORDER BY type, name')
        .all() as Account[]
      return { success: true, data: accounts }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    'accounts:create',
    async (_, account: Omit<Account, 'id' | 'created_at' | 'updated_at'>): Promise<IpcResponse<Account>> => {
      try {
        const db = getDb()
        const now = new Date().toISOString()
        const id = uuidv4()
        const stmt = db.prepare(`
          INSERT INTO accounts (id, name, type, institution, currency, balance, credit_limit, interest_rate, is_budget_account, is_closed, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        stmt.run(
          id,
          account.name,
          account.type,
          account.institution || null,
          account.currency || 'USD',
          account.balance || 0,
          account.credit_limit || null,
          account.interest_rate || null,
          account.is_budget_account ?? 1,
          account.is_closed ?? 0,
          account.notes || null,
          now,
          now
        )
        const created = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account
        return { success: true, data: created }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'accounts:update',
    async (_, id: string, updates: Partial<Account>): Promise<IpcResponse<Account>> => {
      try {
        const db = getDb()
        const now = new Date().toISOString()
        const fields = Object.keys(updates)
          .filter((k) => k !== 'id' && k !== 'created_at')
          .map((k) => `${k} = ?`)
          .join(', ')
        const values = Object.keys(updates)
          .filter((k) => k !== 'id' && k !== 'created_at')
          .map((k) => (updates as Record<string, unknown>)[k])

        db.prepare(`UPDATE accounts SET ${fields}, updated_at = ? WHERE id = ?`).run(
          ...values,
          now,
          id
        )
        const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account
        return { success: true, data: updated }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle('accounts:delete', async (_, id: string): Promise<IpcResponse<boolean>> => {
    try {
      const db = getDb()
      db.prepare('UPDATE accounts SET is_closed = 1, updated_at = ? WHERE id = ?').run(
        new Date().toISOString(),
        id
      )
      return { success: true, data: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
