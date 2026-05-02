import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database'
import { Goal, GoalContribution, IpcResponse } from '../../shared/types'

export function registerGoalHandlers(): void {
  ipcMain.handle('goals:list', async (): Promise<IpcResponse<Goal[]>> => {
    try {
      const db = getDb()
      const goals = db
        .prepare('SELECT * FROM goals WHERE status != \'completed\' ORDER BY created_at DESC')
        .all() as Goal[]
      return { success: true, data: goals }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    'goals:create',
    async (_, goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>): Promise<IpcResponse<Goal>> => {
      try {
        const db = getDb()
        const id = uuidv4()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO goals (id, name, type, target_amount, current_amount, target_date,
            monthly_contribution, linked_account_ids, notes, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          goal.name,
          goal.type,
          goal.target_amount,
          goal.current_amount || 0,
          goal.target_date || null,
          goal.monthly_contribution || null,
          goal.linked_account_ids || null,
          goal.notes || null,
          goal.status || 'active',
          now,
          now
        )
        const created = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as Goal
        return { success: true, data: created }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'goals:update',
    async (_, id: string, updates: Partial<Goal>): Promise<IpcResponse<Goal>> => {
      try {
        const db = getDb()
        const now = new Date().toISOString()
        const allowed = [
          'name', 'type', 'target_amount', 'current_amount', 'target_date',
          'monthly_contribution', 'linked_account_ids', 'notes', 'status'
        ]
        const fields = Object.keys(updates)
          .filter((k) => allowed.includes(k))
          .map((k) => `${k} = ?`)
          .join(', ')
        const values = Object.keys(updates)
          .filter((k) => allowed.includes(k))
          .map((k) => (updates as Record<string, unknown>)[k])

        if (fields) {
          db.prepare(`UPDATE goals SET ${fields}, updated_at = ? WHERE id = ?`).run(
            ...values,
            now,
            id
          )
        }
        const updated = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as Goal
        return { success: true, data: updated }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle('goals:delete', async (_, id: string): Promise<IpcResponse<boolean>> => {
    try {
      const db = getDb()
      db.prepare('DELETE FROM goal_contributions WHERE goal_id = ?').run(id)
      db.prepare('DELETE FROM goals WHERE id = ?').run(id)
      return { success: true, data: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    'goals:add-contribution',
    async (_, contribution: Omit<GoalContribution, 'id'>): Promise<IpcResponse<GoalContribution>> => {
      try {
        const db = getDb()
        const id = uuidv4()
        db.prepare(
          'INSERT INTO goal_contributions (id, goal_id, amount, date, notes) VALUES (?, ?, ?, ?, ?)'
        ).run(id, contribution.goal_id, contribution.amount, contribution.date, contribution.notes || null)

        // Update goal current_amount
        db.prepare(
          'UPDATE goals SET current_amount = current_amount + ?, updated_at = ? WHERE id = ?'
        ).run(contribution.amount, new Date().toISOString(), contribution.goal_id)

        const created = db
          .prepare('SELECT * FROM goal_contributions WHERE id = ?')
          .get(id) as GoalContribution
        return { success: true, data: created }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )
}
