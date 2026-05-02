import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database'
import { PlanNote, RecurringItem, IpcResponse } from '../../shared/types'

export function registerPlanNoteHandlers(): void {
  ipcMain.handle('plan-notes:list', async (): Promise<IpcResponse<PlanNote[]>> => {
    try {
      const db = getDb()
      const notes = db
        .prepare('SELECT * FROM plan_notes ORDER BY effective_date DESC, created_at DESC')
        .all() as PlanNote[]
      return { success: true, data: notes }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    'plan-notes:create',
    async (_, note: Omit<PlanNote, 'id' | 'created_at' | 'updated_at'>): Promise<IpcResponse<PlanNote>> => {
      try {
        const db = getDb()
        const id = uuidv4()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO plan_notes (id, title, body, category, effective_date, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, note.title, note.body, note.category || null, note.effective_date, now, now)
        const created = db.prepare('SELECT * FROM plan_notes WHERE id = ?').get(id) as PlanNote
        return { success: true, data: created }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'plan-notes:update',
    async (_, id: string, updates: Partial<PlanNote>): Promise<IpcResponse<PlanNote>> => {
      try {
        const db = getDb()
        const now = new Date().toISOString()
        const allowed = ['title', 'body', 'category', 'effective_date']
        const fields = Object.keys(updates)
          .filter((k) => allowed.includes(k))
          .map((k) => `${k} = ?`)
          .join(', ')
        const values = Object.keys(updates)
          .filter((k) => allowed.includes(k))
          .map((k) => (updates as Record<string, unknown>)[k])

        if (fields) {
          db.prepare(`UPDATE plan_notes SET ${fields}, updated_at = ? WHERE id = ?`).run(
            ...values,
            now,
            id
          )
        }
        const updated = db.prepare('SELECT * FROM plan_notes WHERE id = ?').get(id) as PlanNote
        return { success: true, data: updated }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle('plan-notes:delete', async (_, id: string): Promise<IpcResponse<boolean>> => {
    try {
      const db = getDb()
      db.prepare('DELETE FROM plan_notes WHERE id = ?').run(id)
      return { success: true, data: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // Recurring items handlers
  ipcMain.handle('recurring:list', async (): Promise<IpcResponse<RecurringItem[]>> => {
    try {
      const db = getDb()
      const items = db
        .prepare('SELECT * FROM recurring_items WHERE is_active = 1 ORDER BY next_date')
        .all() as RecurringItem[]
      return { success: true, data: items }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    'recurring:create',
    async (_, item: Omit<RecurringItem, 'id' | 'created_at' | 'updated_at'>): Promise<IpcResponse<RecurringItem>> => {
      try {
        const db = getDb()
        const id = uuidv4()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO recurring_items (id, account_id, name, amount, type, frequency, next_date, category_id, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          item.account_id || null,
          item.name,
          item.amount,
          item.type,
          item.frequency,
          item.next_date,
          item.category_id || null,
          item.is_active ?? 1,
          now,
          now
        )
        const created = db
          .prepare('SELECT * FROM recurring_items WHERE id = ?')
          .get(id) as RecurringItem
        return { success: true, data: created }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'recurring:update',
    async (_, id: string, updates: Partial<RecurringItem>): Promise<IpcResponse<RecurringItem>> => {
      try {
        const db = getDb()
        const now = new Date().toISOString()
        const allowed = ['name', 'amount', 'type', 'frequency', 'next_date', 'category_id', 'is_active', 'account_id']
        const fields = Object.keys(updates)
          .filter((k) => allowed.includes(k))
          .map((k) => `${k} = ?`)
          .join(', ')
        const values = Object.keys(updates)
          .filter((k) => allowed.includes(k))
          .map((k) => (updates as Record<string, unknown>)[k])

        if (fields) {
          db.prepare(`UPDATE recurring_items SET ${fields}, updated_at = ? WHERE id = ?`).run(
            ...values,
            now,
            id
          )
        }
        const updated = db
          .prepare('SELECT * FROM recurring_items WHERE id = ?')
          .get(id) as RecurringItem
        return { success: true, data: updated }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle('recurring:delete', async (_, id: string): Promise<IpcResponse<boolean>> => {
    try {
      const db = getDb()
      db.prepare('UPDATE recurring_items SET is_active = 0, updated_at = ? WHERE id = ?').run(
        new Date().toISOString(),
        id
      )
      return { success: true, data: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
