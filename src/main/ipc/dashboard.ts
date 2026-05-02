import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database'
import { DashboardSummary, IpcResponse } from '../../shared/types'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { syncAllAccountBalances } from './balance-utils'

export function registerDashboardHandlers(): void {
  ipcMain.handle('dashboard:summary', async (): Promise<IpcResponse<DashboardSummary>> => {
    try {
      const db = getDb()
      syncAllAccountBalances(db)
      const now = new Date()
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

      // Accounts
      const accounts = db
        .prepare('SELECT * FROM accounts WHERE is_closed = 0 ORDER BY type, name')
        .all() as DashboardSummary['accounts']

      // Net worth
      const liabilityTypes = ['credit_card', 'loan', 'student_loan', 'liability']
      let totalAssets = 0
      let totalLiabilities = 0
      for (const acc of accounts) {
        if (liabilityTypes.includes(acc.type)) {
          totalLiabilities += Math.abs(Math.min(acc.balance, 0))
        } else {
          totalAssets += Math.max(acc.balance, 0)
        }
      }
      const netWorth = totalAssets - totalLiabilities

      // Monthly income
      const incomeResult = db
        .prepare(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM transactions
          WHERE type IN ('income', 'dividend', 'interest')
          AND date >= ? AND date <= ?
          AND status != 'pending'
        `)
        .get(monthStart, monthEnd) as { total: number }
      const monthlyIncome = incomeResult.total

      // Monthly spending
      const spendingResult = db
        .prepare(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM transactions
          WHERE type IN ('expense', 'fee')
          AND date >= ? AND date <= ?
          AND status != 'pending'
        `)
        .get(monthStart, monthEnd) as { total: number }
      const monthlySpending = spendingResult.total

      const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlySpending) / monthlyIncome) * 100 : 0

      // Recent transactions
      const recentTransactions = db
        .prepare(`
          SELECT t.*, c.name as category_name, a.name as account_name
          FROM transactions t
          LEFT JOIN categories c ON t.category_id = c.id
          LEFT JOIN accounts a ON t.account_id = a.id
          ORDER BY t.date DESC, t.created_at DESC
          LIMIT 10
        `)
        .all() as DashboardSummary['recentTransactions']

      // Upcoming bills (next 30 days)
      const next30 = format(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
      const today = format(now, 'yyyy-MM-dd')
      const upcomingBills = db
        .prepare(`
          SELECT * FROM recurring_items
          WHERE is_active = 1 AND next_date >= ? AND next_date <= ?
          ORDER BY next_date
          LIMIT 10
        `)
        .all(today, next30) as DashboardSummary['upcomingBills']

      // Net worth history (last 12 months)
      const twelveMonthsAgo = format(subMonths(now, 12), 'yyyy-MM-dd')
      const netWorthHistory = db
        .prepare(`
          SELECT * FROM net_worth_snapshots
          WHERE date >= ?
          ORDER BY date ASC
        `)
        .all(twelveMonthsAgo) as DashboardSummary['netWorthHistory']

      // If no history, add current snapshot
      if (netWorthHistory.length === 0) {
        const snapshotId = uuidv4()
        const snapshotDate = format(now, 'yyyy-MM-dd')
        db.prepare(`
          INSERT INTO net_worth_snapshots (id, date, total_assets, total_liabilities, net_worth, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(snapshotId, snapshotDate, totalAssets, totalLiabilities, netWorth, new Date().toISOString())
        netWorthHistory.push({
          id: snapshotId,
          date: snapshotDate,
          total_assets: totalAssets,
          total_liabilities: totalLiabilities,
          net_worth: netWorth,
          created_at: new Date().toISOString()
        })
      }

      // Spending by category (this month)
      const spendingByCategory = db
        .prepare(`
          SELECT
            COALESCE(c.name, 'Uncategorized') as category,
            SUM(t.amount) as amount,
            c.color
          FROM transactions t
          LEFT JOIN categories c ON t.category_id = c.id
          WHERE t.type IN ('expense', 'fee')
          AND t.date >= ? AND t.date <= ?
          AND t.status != 'pending'
          GROUP BY t.category_id
          ORDER BY amount DESC
          LIMIT 10
        `)
        .all(monthStart, monthEnd) as DashboardSummary['spendingByCategory']

      return {
        success: true,
        data: {
          netWorth,
          monthlyIncome,
          monthlySpending,
          savingsRate,
          accounts,
          recentTransactions,
          upcomingBills,
          netWorthHistory,
          spendingByCategory
        }
      }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('net-worth:history', async (): Promise<IpcResponse<DashboardSummary['netWorthHistory']>> => {
    try {
      const db = getDb()
      const history = db
        .prepare('SELECT * FROM net_worth_snapshots ORDER BY date ASC')
        .all() as DashboardSummary['netWorthHistory']
      return { success: true, data: history }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
