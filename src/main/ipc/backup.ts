import { ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { getDb, getDataDirectory } from '../database'
import { IpcResponse } from '../../shared/types'

export function registerBackupHandlers(): void {
  ipcMain.handle('backup:export', async (): Promise<IpcResponse<string>> => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Export Encrypted Backup',
        defaultPath: `ledgerwise-backup-${new Date().toISOString().split('T')[0]}.lwbak`,
        filters: [{ name: 'LedgerWise Backup', extensions: ['lwbak'] }]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Cancelled' }
      }

      const db = getDb()

      // Export all tables as JSON
      const tables = [
        'accounts', 'categories', 'category_rules', 'transactions', 'splits',
        'goals', 'goal_contributions', 'holdings', 'allocation_targets',
        'recurring_items', 'plan_notes', 'net_worth_snapshots'
      ]

      const backup: Record<string, unknown[]> = {}
      for (const table of tables) {
        backup[table] = db.prepare(`SELECT * FROM ${table}`).all()
      }

      const jsonData = JSON.stringify({ version: 1, exported_at: new Date().toISOString(), data: backup })

      // Encrypt with a random key and store the key alongside
      const encKey = crypto.randomBytes(32)
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv)
      const encrypted = Buffer.concat([cipher.update(Buffer.from(jsonData)), cipher.final()])
      const authTag = cipher.getAuthTag()

      // Save: [4-byte key length][key][12-byte iv][16-byte authTag][encrypted data]
      const header = Buffer.concat([
        Buffer.from([0, 0, 0, 32]), // key length
        encKey,
        iv,
        authTag
      ])

      fs.writeFileSync(result.filePath, Buffer.concat([header, encrypted]))
      return { success: true, data: result.filePath }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('backup:import', async (): Promise<IpcResponse<boolean>> => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Import Backup',
        filters: [{ name: 'LedgerWise Backup', extensions: ['lwbak'] }],
        properties: ['openFile']
      })

      if (result.canceled || !result.filePaths[0]) {
        return { success: false, error: 'Cancelled' }
      }

      const fileData = fs.readFileSync(result.filePaths[0])

      // Parse header
      const keyLen = fileData.readUInt32BE(0)
      const encKey = fileData.slice(4, 4 + keyLen)
      const iv = fileData.slice(4 + keyLen, 4 + keyLen + 12)
      const authTag = fileData.slice(4 + keyLen + 12, 4 + keyLen + 28)
      const encrypted = fileData.slice(4 + keyLen + 28)

      const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv)
      decipher.setAuthTag(authTag)
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
      const backup = JSON.parse(decrypted.toString('utf-8'))

      const db = getDb()

      const ALLOWED_TABLES = new Set([
        'accounts', 'categories', 'category_rules', 'transactions', 'splits',
        'goals', 'goal_contributions', 'holdings', 'allocation_targets',
        'recurring_items', 'plan_notes', 'net_worth_snapshots'
      ])
      const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/

      const doRestore = db.transaction(() => {
        const tables = Object.keys(backup.data).filter((t) => ALLOWED_TABLES.has(t))
        for (const table of tables) {
          db.prepare(`DELETE FROM ${table}`).run()
          const rows = backup.data[table] as Record<string, unknown>[]
          if (rows.length === 0) continue
          const cols = Object.keys(rows[0]).filter((c) => SAFE_IDENTIFIER.test(c))
          if (cols.length === 0) continue
          const placeholders = cols.map(() => '?').join(', ')
          const stmt = db.prepare(
            `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
          )
          for (const row of rows) {
            stmt.run(...cols.map((c) => row[c]))
          }
        }
      })

      doRestore()
      return { success: true, data: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('export:csv', async (): Promise<IpcResponse<string>> => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Export Transactions as CSV',
        defaultPath: `ledgerwise-transactions-${new Date().toISOString().split('T')[0]}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Cancelled' }
      }

      const db = getDb()
      const transactions = db
        .prepare(`
          SELECT t.date, t.payee, t.memo, t.amount, t.type, t.status,
                 c.name as category, a.name as account
          FROM transactions t
          LEFT JOIN categories c ON t.category_id = c.id
          LEFT JOIN accounts a ON t.account_id = a.id
          ORDER BY t.date DESC
        `)
        .all() as Record<string, unknown>[]

      if (transactions.length === 0) {
        return { success: false, error: 'No transactions to export' }
      }

      const headers = Object.keys(transactions[0])
      const csvLines = [
        headers.join(','),
        ...transactions.map((row) =>
          headers
            .map((h) => {
              const val = row[h]
              if (val === null || val === undefined) return ''
              const str = String(val)
              return str.includes(',') || str.includes('"') || str.includes('\n')
                ? `"${str.replace(/"/g, '""')}"`
                : str
            })
            .join(',')
        )
      ]

      fs.writeFileSync(result.filePath, csvLines.join('\n'), 'utf-8')
      return { success: true, data: result.filePath }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
