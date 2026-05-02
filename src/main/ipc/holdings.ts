import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database'
import { Holding, AllocationTarget, IpcResponse } from '../../shared/types'

export function registerHoldingHandlers(): void {
  ipcMain.handle('holdings:list', async (): Promise<IpcResponse<Holding[]>> => {
    try {
      const db = getDb()
      const holdings = db
        .prepare(`
          SELECT h.*, a.name as account_name
          FROM holdings h
          LEFT JOIN accounts a ON h.account_id = a.id
          ORDER BY h.current_value DESC NULLS LAST, h.name
        `)
        .all() as Holding[]
      return { success: true, data: holdings }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    'holdings:create',
    async (_, holding: Omit<Holding, 'id' | 'created_at' | 'updated_at'>): Promise<IpcResponse<Holding>> => {
      try {
        const db = getDb()
        const id = uuidv4()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO holdings (id, account_id, symbol, name, quantity, cost_basis, current_price, current_value, asset_class, tax_bucket, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          holding.account_id,
          holding.symbol || null,
          holding.name,
          holding.quantity || 0,
          holding.cost_basis || null,
          holding.current_price || null,
          holding.current_value || (holding.quantity && holding.current_price ? holding.quantity * holding.current_price : null),
          holding.asset_class || null,
          holding.tax_bucket || null,
          now,
          now
        )
        const created = db.prepare('SELECT * FROM holdings WHERE id = ?').get(id) as Holding
        return { success: true, data: created }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'holdings:update',
    async (_, id: string, updates: Partial<Holding>): Promise<IpcResponse<Holding>> => {
      try {
        const db = getDb()
        const now = new Date().toISOString()
        const allowed = [
          'symbol', 'name', 'quantity', 'cost_basis', 'current_price',
          'current_value', 'asset_class', 'tax_bucket', 'account_id'
        ]
        const fields = Object.keys(updates)
          .filter((k) => allowed.includes(k))
          .map((k) => `${k} = ?`)
          .join(', ')
        const values = Object.keys(updates)
          .filter((k) => allowed.includes(k))
          .map((k) => (updates as Record<string, unknown>)[k])

        if (fields) {
          db.prepare(`UPDATE holdings SET ${fields}, updated_at = ? WHERE id = ?`).run(
            ...values,
            now,
            id
          )
        }
        const updated = db.prepare('SELECT * FROM holdings WHERE id = ?').get(id) as Holding
        return { success: true, data: updated }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle('holdings:delete', async (_, id: string): Promise<IpcResponse<boolean>> => {
    try {
      const db = getDb()
      db.prepare('DELETE FROM holdings WHERE id = ?').run(id)
      return { success: true, data: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    'allocation-targets:list',
    async (): Promise<IpcResponse<AllocationTarget[]>> => {
      try {
        const db = getDb()
        const targets = db
          .prepare('SELECT * FROM allocation_targets ORDER BY asset_class')
          .all() as AllocationTarget[]
        return { success: true, data: targets }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'allocation-targets:upsert',
    async (_, target: Omit<AllocationTarget, 'id' | 'created_at' | 'updated_at'>): Promise<IpcResponse<AllocationTarget>> => {
      try {
        const db = getDb()
        const now = new Date().toISOString()
        const existing = db
          .prepare('SELECT * FROM allocation_targets WHERE asset_class = ?')
          .get(target.asset_class) as AllocationTarget | undefined

        if (existing) {
          db.prepare(
            'UPDATE allocation_targets SET target_pct = ?, tolerance_pct = ?, updated_at = ? WHERE asset_class = ?'
          ).run(target.target_pct, target.tolerance_pct || 5, now, target.asset_class)
          const updated = db
            .prepare('SELECT * FROM allocation_targets WHERE asset_class = ?')
            .get(target.asset_class) as AllocationTarget
          return { success: true, data: updated }
        } else {
          const id = uuidv4()
          db.prepare(
            'INSERT INTO allocation_targets (id, asset_class, target_pct, tolerance_pct, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(id, target.asset_class, target.target_pct, target.tolerance_pct || 5, now, now)
          const created = db
            .prepare('SELECT * FROM allocation_targets WHERE id = ?')
            .get(id) as AllocationTarget
          return { success: true, data: created }
        }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )
}
