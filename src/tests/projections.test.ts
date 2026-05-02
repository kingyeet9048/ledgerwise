import { describe, it, expect } from 'vitest'
import { runProjectionEngine } from '../main/ipc/projections-engine'
import { Account, RecurringItem, Goal, ProjectionAssumptions } from '../shared/types'

function makeAccount(overrides: Partial<Account> & { id: string }): Account {
  return {
    name: 'Test Account',
    type: 'checking',
    institution: undefined,
    currency: 'USD',
    balance: 10000,
    is_budget_account: 1,
    is_closed: 0,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides
  }
}

function makeRecurring(overrides: Partial<RecurringItem> & { id: string }): RecurringItem {
  return {
    name: 'Income',
    amount: 5000,
    type: 'income',
    frequency: 'monthly',
    next_date: '2026-06-01',
    is_active: 1,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides
  }
}

const flatAssumptions: ProjectionAssumptions = {
  investmentReturnRate: 0,
  inflationRate: 0,
  incomeGrowthRate: 0,
  monthsToProject: 3,
  additionalMonthlyContribution: 0
}

describe('runProjectionEngine – additionalMonthlyContribution not double-counted', () => {
  it('adds contribution exactly once per month', () => {
    const checking = makeAccount({ id: 'checking1', balance: 0 })
    const contribution = 1000
    const result = runProjectionEngine(
      [checking],
      [],
      [],
      { ...flatAssumptions, additionalMonthlyContribution: contribution, monthsToProject: 1 }
    )
    // With zero recurring income/expenses and $1000 contribution, balance after month 1 = $1000
    expect(result.months[0].accountBalances['checking1']).toBeCloseTo(1000, 2)
  })

  it('contribution over multiple months grows linearly with no base cashflow', () => {
    const checking = makeAccount({ id: 'checking1', balance: 0 })
    const result = runProjectionEngine(
      [checking],
      [],
      [],
      { ...flatAssumptions, additionalMonthlyContribution: 500, monthsToProject: 3 }
    )
    expect(result.months[0].accountBalances['checking1']).toBeCloseTo(500, 2)
    expect(result.months[1].accountBalances['checking1']).toBeCloseTo(1000, 2)
    expect(result.months[2].accountBalances['checking1']).toBeCloseTo(1500, 2)
  })

  it('contribution + recurring income sum correctly without duplication', () => {
    const checking = makeAccount({ id: 'checking1', balance: 0 })
    const income = makeRecurring({ id: 'r1', amount: 1000, type: 'income' })
    const result = runProjectionEngine(
      [checking],
      [income],
      [],
      { ...flatAssumptions, additionalMonthlyContribution: 500, monthsToProject: 1 }
    )
    // Should be 1000 (recurring) + 500 (contribution) = 1500
    expect(result.months[0].accountBalances['checking1']).toBeCloseTo(1500, 2)
  })
})

describe('runProjectionEngine – investment returns', () => {
  it('compounds investment account at given monthly rate', () => {
    const brokerage = makeAccount({ id: 'brok1', type: 'brokerage', balance: 10000 })
    const annualRate = 0.12
    const result = runProjectionEngine(
      [brokerage],
      [],
      [],
      { ...flatAssumptions, investmentReturnRate: annualRate, monthsToProject: 12 }
    )
    // After 12 months at 12% annual, balance ≈ 10000 * 1.12
    expect(result.months[11].accountBalances['brok1']).toBeCloseTo(10000 * 1.12, 0)
  })

  it('does not apply investment returns to checking accounts', () => {
    const checking = makeAccount({ id: 'chk1', type: 'checking', balance: 5000 })
    const result = runProjectionEngine(
      [checking],
      [],
      [],
      { ...flatAssumptions, investmentReturnRate: 0.12, monthsToProject: 1 }
    )
    expect(result.months[0].accountBalances['chk1']).toBeCloseTo(5000, 2)
  })
})

describe('runProjectionEngine – debt payoff tracking', () => {
  it('pays down debt with surplus cash flow and records payoff date', () => {
    // $100 CC debt, $500 income - $300 expenses = $200 surplus → paid off in month 1
    const cc = makeAccount({ id: 'cc1', type: 'credit_card', balance: -100 })
    const checking = makeAccount({ id: 'chk1', type: 'checking', balance: 0 })
    const income = makeRecurring({ id: 'r1', amount: 500, type: 'income' })
    const expense = makeRecurring({ id: 'r2', amount: 300, type: 'expense' })
    const result = runProjectionEngine(
      [cc, checking],
      [income, expense],
      [],
      { ...flatAssumptions, monthsToProject: 3 }
    )
    // CC should be paid off in month 1 (after interest + $200 surplus)
    expect(result.months[0].accountBalances['cc1']).toBe(0)
    expect(Object.keys(result.debtPayoffDates)).toContain('cc1')
  })

  it('remaining surplus after debt payoff goes to checking', () => {
    // $100 CC, $200 surplus → after paying CC, $100 remains for checking
    const cc = makeAccount({ id: 'cc1', type: 'credit_card', balance: -100 })
    const checking = makeAccount({ id: 'chk1', type: 'checking', balance: 0 })
    const income = makeRecurring({ id: 'r1', amount: 500, type: 'income' })
    const expense = makeRecurring({ id: 'r2', amount: 300, type: 'expense' })
    const result = runProjectionEngine(
      [cc, checking],
      [income, expense],
      [],
      { ...flatAssumptions, monthsToProject: 1 }
    )
    // Interest makes CC slightly more than 100 before payment, but checking still gets remainder
    expect(result.months[0].accountBalances['chk1']).toBeGreaterThan(0)
  })
})

describe('runProjectionEngine – goal progress', () => {
  it('projects goal progress based on monthly_contribution', () => {
    const goal: Goal = {
      id: 'g1',
      name: 'Emergency Fund',
      type: 'emergency_fund',
      target_amount: 10000,
      current_amount: 1000,
      monthly_contribution: 500,
      status: 'active',
      created_at: '2026-01-01',
      updated_at: '2026-01-01'
    }
    const result = runProjectionEngine([], [], [goal], flatAssumptions)
    // After 3 months: 1000 + 500*3 = 2500
    expect(result.months[2].goalProgress['g1']).toBeCloseTo(2500, 2)
  })

  it('caps goal progress at target_amount', () => {
    const goal: Goal = {
      id: 'g1',
      name: 'Small Goal',
      type: 'savings',
      target_amount: 1100,
      current_amount: 1000,
      monthly_contribution: 500,
      status: 'active',
      created_at: '2026-01-01',
      updated_at: '2026-01-01'
    }
    const result = runProjectionEngine([], [], [goal], { ...flatAssumptions, monthsToProject: 6 })
    for (const month of result.months) {
      expect(month.goalProgress['g1']).toBeLessThanOrEqual(1100)
    }
  })
})

describe('runProjectionEngine – netWorth calculation', () => {
  it('netWorth = totalAssets - totalLiabilities', () => {
    const checking = makeAccount({ id: 'chk1', balance: 5000 })
    const cc = makeAccount({ id: 'cc1', type: 'credit_card', balance: -2000 })
    const result = runProjectionEngine([checking, cc], [], [], { ...flatAssumptions, monthsToProject: 1 })
    expect(result.months[0].netWorth).toBeCloseTo(
      result.months[0].totalAssets - result.months[0].totalLiabilities,
      4
    )
  })
})
