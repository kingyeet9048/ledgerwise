import { ipcMain } from 'electron'
import { getDb } from '../database'
import {
  Account,
  RecurringItem,
  Goal,
  ProjectionAssumptions,
  ProjectionResult,
  ProjectionMonth,
  IpcResponse
} from '../../shared/types'
import { addMonths, format, parseISO } from 'date-fns'

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
          .prepare('SELECT * FROM recurring_items WHERE is_active = 1')
          .all() as RecurringItem[]

        const goals = db
          .prepare('SELECT * FROM goals WHERE status = \'active\'')
          .all() as Goal[]

        const result = runProjectionEngine(accounts, recurringItems, goals, assumptions)
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )
}

function runProjectionEngine(
  accounts: Account[],
  recurringItems: RecurringItem[],
  goals: Goal[],
  assumptions: ProjectionAssumptions
): ProjectionResult {
  const {
    investmentReturnRate,
    inflationRate,
    incomeGrowthRate,
    monthsToProject,
    additionalMonthlyContribution = 0
  } = assumptions

  const monthlyInvestmentReturn = Math.pow(1 + investmentReturnRate, 1 / 12) - 1
  const monthlyInflation = Math.pow(1 + inflationRate, 1 / 12) - 1
  const monthlyIncomeGrowth = Math.pow(1 + incomeGrowthRate, 1 / 12) - 1

  // Separate accounts by type
  const investmentTypes = new Set(['brokerage', 'retirement', 'hsa'])
  const liabilityTypes = new Set(['credit_card', 'loan', 'student_loan', 'liability'])

  // Build initial balances
  const balances: Record<string, number> = {}
  for (const account of accounts) {
    balances[account.id] = account.balance
  }

  // Calculate base monthly cash flow from recurring items
  let baseMonthlyCashFlow = 0
  for (const item of recurringItems) {
    const monthly = toMonthlyAmount(item.amount, item.frequency)
    if (item.type === 'income') {
      baseMonthlyCashFlow += monthly
    } else {
      baseMonthlyCashFlow -= monthly
    }
  }

  const months: ProjectionMonth[] = []
  const debtPayoffDates: Record<string, string> = {}

  const today = new Date()

  for (let i = 1; i <= monthsToProject; i++) {
    const monthDate = addMonths(today, i)
    const monthStr = format(monthDate, 'yyyy-MM')

    // Apply growth rates
    const incomeGrowthFactor = Math.pow(1 + monthlyIncomeGrowth, i)
    const inflationFactor = Math.pow(1 + monthlyInflation, i)

    // Net cash flow for this month
    const adjustedCashFlow = baseMonthlyCashFlow * incomeGrowthFactor - additionalMonthlyContribution * 0 + additionalMonthlyContribution

    // Apply investment returns to investment accounts
    for (const account of accounts) {
      if (investmentTypes.has(account.type) && balances[account.id] > 0) {
        balances[account.id] *= (1 + monthlyInvestmentReturn)
      }
    }

    // Apply monthly cash flow to checking/savings accounts
    const cashAccounts = accounts.filter(
      (a) => a.type === 'checking' || a.type === 'savings'
    )
    if (cashAccounts.length > 0) {
      const cashPerAccount = adjustedCashFlow / cashAccounts.length
      for (const acc of cashAccounts) {
        balances[acc.id] = (balances[acc.id] || 0) + cashPerAccount + additionalMonthlyContribution / cashAccounts.length
      }
    }

    // Apply interest to debt accounts
    for (const account of accounts) {
      if (liabilityTypes.has(account.type) && balances[account.id] < 0) {
        const monthlyRate = (account.interest_rate || 0.18) / 12
        balances[account.id] *= (1 + monthlyRate)

        // Check if paid off
        if (balances[account.id] >= 0 && !debtPayoffDates[account.id]) {
          debtPayoffDates[account.id] = monthStr
          balances[account.id] = 0
        }
      }
    }

    // Calculate totals
    let totalAssets = 0
    let totalLiabilities = 0

    for (const account of accounts) {
      const bal = balances[account.id] || 0
      if (liabilityTypes.has(account.type)) {
        totalLiabilities += Math.abs(Math.min(bal, 0))
      } else {
        totalAssets += Math.max(bal, 0)
      }
    }

    // Goal progress
    const goalProgress: Record<string, number> = {}
    for (const goal of goals) {
      const monthsElapsed = i
      const contribution = (goal.monthly_contribution || 0) * monthsElapsed
      const projected = Math.min(goal.current_amount + contribution, goal.target_amount)
      goalProgress[goal.id] = projected
    }

    months.push({
      month: monthStr,
      netWorth: totalAssets - totalLiabilities,
      totalAssets,
      totalLiabilities,
      accountBalances: { ...balances },
      goalProgress
    })
  }

  return {
    months,
    debtPayoffDates,
    assumptions
  }
}

function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly':
      return amount * 52 / 12
    case 'biweekly':
      return amount * 26 / 12
    case 'monthly':
      return amount
    case 'quarterly':
      return amount / 3
    case 'annually':
      return amount / 12
    default:
      return amount
  }
}
