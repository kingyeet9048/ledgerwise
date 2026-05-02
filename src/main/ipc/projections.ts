import { ipcMain } from 'electron'
import { getDb } from '../database'
import { Account, RecurringItem, Goal, ProjectionAssumptions, ProjectionResult, IpcResponse } from '../../shared/types'
import { runProjectionEngine } from './projections-engine'

export function registerProjectionHandlers(): void {
  ipcMain.handle(
    'projections:run',
    async (_, assumptions: ProjectionAssumptions): Promise<IpcResponse<ProjectionResult>> => {
      try {
        const db = getDb()

        const accounts = db
          .prepare('SELECT * FROM accounts WHERE is_closed = 0')
          .all() as Account[]

        const recurringItems = db
          .prepare("SELECT * FROM recurring_items WHERE is_active = 1")
          .all() as RecurringItem[]

        const goals = db
          .prepare("SELECT * FROM goals WHERE status = 'active'")
          .all() as Goal[]

        const result = runProjectionEngine(accounts, recurringItems, goals, assumptions)
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )
}
