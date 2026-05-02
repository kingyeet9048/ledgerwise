import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database'
import { Account, IpcResponse } from '../../shared/types'
import { recalcAccountBalance, upsertOpeningBalance } from './balance-utils'

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
        const initialBalance = account.balance || 0

        db.prepare(`
          INSERT INTO accounts (id, name, type, institution, currency, balance, credit_limit, interest_rate, is_budget_account, is_closed, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          account.name,
          account.type,
          account.institution || null,
          account.currency || 'USD',
          account.credit_limit || null,
          account.interest_rate || null,
          account.is_budget_account ?? 1,
          account.is_closed ?? 0,
          account.notes || null,
          now,
          now
        )

        // Represent the user's starting balance as a synthetic "Opening Balance"
        // transaction so that recalcAccountBalance always yields the right number.
        if (Math.abs(initialBalance) >= 0.01) {
          upsertOpeningBalance(db, id, account.type, initialBalance)
          recalcAccountBalance(db, id)
        }

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

        const currentAccount = db
          .prepare('SELECT * FROM accounts WHERE id = ?')
          .get(id) as Account | undefined
        if (!currentAccount) return { success: false, error: 'Account not found' }

        // These fields are directly updatable; balance is computed from transactions.
        const directFields = [
          'name', 'type', 'institution', 'currency', 'credit_limit',
          'interest_rate', 'is_budget_account', 'is_closed', 'notes'
        ]
        const directUpdates = Object.keys(updates).filter((k) => directFields.includes(k))

        if (directUpdates.length > 0) {
          const setClause = directUpdates.map((k) => `${k} = ?`).join(', ')
          const values = directUpdates.map((k) => (updates as Record<string, unknown>)[k])
          db.prepare(`UPDATE accounts SET ${setClause}, updated_at = ? WHERE id = ?`).run(
            ...values,
            now,
            id
          )
        }

        // If the user changed the balance or account type, re-anchor the opening balance
        const balanceChanged = 'balance' in updates
        const typeChanged = 'type' in updates

        if (balanceChanged || typeChanged) {
          const newBalance = balanceChanged
            ? ((updates.balance as number) ?? 0)
            : currentAccount.balance
          const newType = typeChanged
            ? ((updates.type as string) ?? currentAccount.type)
            : currentAccount.type
          upsertOpeningBalance(db, id, newType, newBalance)
          recalcAccountBalance(db, id)
        }

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
