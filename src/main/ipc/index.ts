import { ipcMain } from 'electron'
import { setupDatabase, unlockDatabase, isSetup, changePassphrase } from '../database'
import { IpcResponse } from '../../shared/types'
import { registerAccountHandlers } from './accounts'
import { registerTransactionHandlers } from './transactions'
import { registerCategoryHandlers } from './categories'
import { registerGoalHandlers } from './goals'
import { registerHoldingHandlers } from './holdings'
import { registerImportHandlers } from './import'
import { registerProjectionHandlers } from './projections'
import { registerBackupHandlers } from './backup'
import { registerDashboardHandlers } from './dashboard'
import { registerPlanNoteHandlers } from './plan-notes'

export function registerAllHandlers(): void {
  // DB lifecycle handlers
  ipcMain.handle('db:is-setup', async (): Promise<IpcResponse<boolean>> => {
    try {
      return { success: true, data: isSetup() }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('db:setup', async (_, passphrase: string): Promise<IpcResponse<boolean>> => {
    try {
      await setupDatabase(passphrase)
      return { success: true, data: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('db:unlock', async (_, passphrase: string): Promise<IpcResponse<boolean>> => {
    try {
      await unlockDatabase(passphrase)
      return { success: true, data: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    'db:change-passphrase',
    async (_, oldPassphrase: string, newPassphrase: string): Promise<IpcResponse<boolean>> => {
      try {
        await changePassphrase(oldPassphrase, newPassphrase)
        return { success: true, data: true }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  // Feature handlers
  registerAccountHandlers()
  registerTransactionHandlers()
  registerCategoryHandlers()
  registerGoalHandlers()
  registerHoldingHandlers()
  registerImportHandlers()
  registerProjectionHandlers()
  registerBackupHandlers()
  registerDashboardHandlers()
  registerPlanNoteHandlers()
}
