import {
  Account,
  RecurringItem,
  Goal,
  ProjectionAssumptions,
  ProjectionResult,
  ProjectionMonth
} from '../../shared/types'
import { addMonths, format } from 'date-fns'

export function runProjectionEngine(
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

  const investmentTypes = new Set(['brokerage', 'retirement', 'hsa'])
  const liabilityTypes = new Set(['credit_card', 'loan', 'student_loan', 'liability'])

  // Pre-compute base income and expense separately so inflation only hits expenses
  let baseMonthlyIncome = 0
  let baseMonthlyExpense = 0
  for (const item of recurringItems) {
    const monthly = toMonthlyAmount(item.amount, item.frequency)
    if (item.type === 'income') {
      baseMonthlyIncome += monthly
    } else {
      baseMonthlyExpense += monthly
    }
  }

  const balances: Record<string, number> = {}
  for (const account of accounts) {
    balances[account.id] = account.balance
  }

  const months: ProjectionMonth[] = []
  const debtPayoffDates: Record<string, string> = {}
  const today = new Date()

  const cashAccounts = accounts.filter((a) => a.type === 'checking' || a.type === 'savings')
  const debtAccounts = accounts
    .filter((a) => liabilityTypes.has(a.type))
    .sort((a, b) => (b.interest_rate || 0.18) - (a.interest_rate || 0.18)) // highest rate first

  for (let i = 1; i <= monthsToProject; i++) {
    const monthDate = addMonths(today, i)
    const monthStr = format(monthDate, 'yyyy-MM')

    const incomeGrowthFactor = Math.pow(1 + monthlyIncomeGrowth, i)
    const inflationFactor = Math.pow(1 + monthlyInflation, i)

    // Inflation grows expenses; income growth grows income
    const adjustedCashFlow =
      baseMonthlyIncome * incomeGrowthFactor -
      baseMonthlyExpense * inflationFactor +
      additionalMonthlyContribution

    // 1. Compound investment accounts
    for (const account of accounts) {
      if (investmentTypes.has(account.type) && balances[account.id] > 0) {
        balances[account.id] *= 1 + monthlyInvestmentReturn
      }
    }

    // 2. Apply interest to debt accounts
    for (const account of debtAccounts) {
      if (balances[account.id] < 0) {
        const monthlyRate = (account.interest_rate || 0.18) / 12
        balances[account.id] *= 1 + monthlyRate
      }
    }

    // 3. Distribute cash flow: pay down debt first, then save the remainder
    let surplus = adjustedCashFlow
    if (surplus > 0) {
      for (const account of debtAccounts) {
        if (surplus <= 0) break
        const debt = balances[account.id]
        if (debt < 0) {
          const payment = Math.min(surplus, -debt)
          balances[account.id] += payment
          surplus -= payment
        }
      }
    }

    // Any remaining surplus (or negative cashflow) goes to checking/savings
    if (cashAccounts.length > 0) {
      const cashPerAccount = surplus / cashAccounts.length
      for (const acc of cashAccounts) {
        balances[acc.id] = (balances[acc.id] || 0) + cashPerAccount
      }
    }

    // 4. Record debt payoff dates
    for (const account of debtAccounts) {
      if (balances[account.id] >= 0 && !debtPayoffDates[account.id]) {
        debtPayoffDates[account.id] = monthStr
        balances[account.id] = 0
      }
    }

    // 5. Compute totals
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

    // 6. Goal progress
    const goalProgress: Record<string, number> = {}
    for (const goal of goals) {
      const contribution = (goal.monthly_contribution || 0) * i
      goalProgress[goal.id] = Math.min(goal.current_amount + contribution, goal.target_amount)
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

  return { months, debtPayoffDates, assumptions }
}

function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly':
      return (amount * 52) / 12
    case 'biweekly':
      return (amount * 26) / 12
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
