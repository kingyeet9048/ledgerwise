import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database'
import { Category, CategoryRule, IpcResponse } from '../../shared/types'

export function registerCategoryHandlers(): void {
  ipcMain.handle('categories:list', async (): Promise<IpcResponse<Category[]>> => {
    try {
      const db = getDb()
      const categories = db
        .prepare('SELECT * FROM categories ORDER BY type, parent_id NULLS FIRST, name')
        .all() as Category[]
      return { success: true, data: categories }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    'categories:create',
    async (_, cat: Omit<Category, 'id' | 'created_at'>): Promise<IpcResponse<Category>> => {
      try {
        const db = getDb()
        const id = uuidv4()
        const now = new Date().toISOString()
        db.prepare(
          'INSERT INTO categories (id, name, parent_id, type, color, icon, is_system, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          id,
          cat.name,
          cat.parent_id || null,
          cat.type,
          cat.color || null,
          cat.icon || null,
          cat.is_system || 0,
          now
        )
        const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category
        return { success: true, data: created }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'categories:update',
    async (_, id: string, updates: Partial<Category>): Promise<IpcResponse<Category>> => {
      try {
        const db = getDb()
        const allowed = ['name', 'parent_id', 'type', 'color', 'icon']
        const fields = Object.keys(updates)
          .filter((k) => allowed.includes(k))
          .map((k) => `${k} = ?`)
          .join(', ')
        const values = Object.keys(updates)
          .filter((k) => allowed.includes(k))
          .map((k) => (updates as Record<string, unknown>)[k])

        if (fields) {
          db.prepare(`UPDATE categories SET ${fields} WHERE id = ?`).run(...values, id)
        }
        const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category
        return { success: true, data: updated }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle('categories:delete', async (_, id: string): Promise<IpcResponse<boolean>> => {
    try {
      const db = getDb()
      // Reassign transactions to parent or null
      const cat = db
        .prepare('SELECT parent_id FROM categories WHERE id = ?')
        .get(id) as { parent_id: string | null }
      db.prepare('UPDATE transactions SET category_id = ? WHERE category_id = ?').run(
        cat?.parent_id || null,
        id
      )
      db.prepare('DELETE FROM category_rules WHERE category_id = ?').run(id)
      db.prepare('DELETE FROM categories WHERE id = ?').run(id)
      return { success: true, data: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // Category Rules
  ipcMain.handle('category-rules:list', async (): Promise<IpcResponse<CategoryRule[]>> => {
    try {
      const db = getDb()
      const rules = db
        .prepare('SELECT * FROM category_rules ORDER BY priority DESC, created_at')
        .all() as CategoryRule[]
      return { success: true, data: rules }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    'category-rules:create',
    async (_, rule: Omit<CategoryRule, 'id' | 'created_at'>): Promise<IpcResponse<CategoryRule>> => {
      try {
        const db = getDb()
        const id = uuidv4()
        const now = new Date().toISOString()
        db.prepare(
          'INSERT INTO category_rules (id, pattern, category_id, field, priority, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(id, rule.pattern, rule.category_id, rule.field || 'payee', rule.priority || 0, now)
        const created = db
          .prepare('SELECT * FROM category_rules WHERE id = ?')
          .get(id) as CategoryRule
        return { success: true, data: created }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'category-rules:delete',
    async (_, id: string): Promise<IpcResponse<boolean>> => {
      try {
        const db = getDb()
        db.prepare('DELETE FROM category_rules WHERE id = ?').run(id)
        return { success: true, data: true }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )
}
