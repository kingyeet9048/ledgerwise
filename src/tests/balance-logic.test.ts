/**
 * Tests for the balance calculation formula and opening-balance semantics.
 * These run against the pure formula logic — no real SQLite required.
 */
import { describe, it, expect } from 'vitest'

// The balance formula used by recalcAccountBalance and every query that reads balance
type TxType = 'income' | 'expense' | 'dividend' | 'interest' | 'fee' | 'buy' | 'sell' | 'transfer' | 'other'

interface TxRow { type: TxType; amount: number; status: 'pending' | 'posted' | 'reviewed' }

function computeBalance(rows: TxRow[]): number {
  return rows
    .filter((r) => r.status !== 'pending')
    .reduce((sum, r) => {
      switch (r.type) {
        case 'income':
        case 'dividend':
        case 'interest':
        case 'sell':
          return sum + r.amount
        case 'expense':
        case 'fee':
        case 'buy':
          return sum - r.amount
        default:
          return sum + r.amount
      }
    }, 0)
}

/** Mirrors upsertOpeningBalance logic */
function openingBalanceTx(accountType: string, balance: number): TxRow {
  const liabilities = new Set(['credit_card', 'loan', 'student_loan', 'liability'])
  const isLiability = liabilities.has(accountType)
  const type: TxType = isLiability ? 'expense' : balance >= 0 ? 'income' : 'expense'
  return { type, amount: Math.abs(balance), status: 'posted' }
}

describe('balance formula – pending exclusion', () => {
  it('pending transactions do not affect balance', () => {
    const rows: TxRow[] = [
      { type: 'expense', amount: 50, status: 'pending' },
      { type: 'income', amount: 100, status: 'pending' }
    ]
    expect(computeBalance(rows)).toBe(0)
  })

  it('posted and reviewed transactions DO affect balance', () => {
    const rows: TxRow[] = [
      { type: 'income', amount: 1000, status: 'posted' },
      { type: 'expense', amount: 200, status: 'reviewed' }
    ]
    expect(computeBalance(rows)).toBe(800)
  })

  it('mixed: only non-pending counts', () => {
    const rows: TxRow[] = [
      { type: 'income', amount: 500, status: 'posted' },
      { type: 'expense', amount: 300, status: 'pending' },
    ]
    expect(computeBalance(rows)).toBe(500)
  })
})

describe('balance formula – type cases', () => {
  it('expense subtracts from balance', () => {
    expect(computeBalance([{ type: 'expense', amount: 50, status: 'posted' }])).toBe(-50)
  })

  it('income adds to balance', () => {
    expect(computeBalance([{ type: 'income', amount: 1000, status: 'posted' }])).toBe(1000)
  })

  it('buy subtracts (cash out)', () => {
    expect(computeBalance([{ type: 'buy', amount: 500, status: 'posted' }])).toBe(-500)
  })

  it('sell adds (cash in)', () => {
    expect(computeBalance([{ type: 'sell', amount: 400, status: 'posted' }])).toBe(400)
  })

  it('dividend adds', () => {
    expect(computeBalance([{ type: 'dividend', amount: 25, status: 'posted' }])).toBe(25)
  })

  it('fee subtracts', () => {
    expect(computeBalance([{ type: 'fee', amount: 10, status: 'posted' }])).toBe(-10)
  })
})

describe('opening balance – asset accounts', () => {
  it('checking with $1000 opening → income tx → balance = +1000', () => {
    const opening = openingBalanceTx('checking', 1000)
    expect(opening.type).toBe('income')
    expect(opening.amount).toBe(1000)
    expect(computeBalance([opening])).toBe(1000)
  })

  it('savings with $5000 opening → income tx → balance = +5000', () => {
    const opening = openingBalanceTx('savings', 5000)
    expect(computeBalance([opening])).toBe(5000)
  })

  it('overdrawn checking with -$200 opening → expense tx → balance = -200', () => {
    const opening = openingBalanceTx('checking', -200)
    expect(opening.type).toBe('expense')
    expect(computeBalance([opening])).toBe(-200)
  })

  it('zero opening balance → no opening tx needed', () => {
    const rows: TxRow[] = []
    expect(computeBalance(rows)).toBe(0)
  })
})

describe('opening balance – liability accounts', () => {
  it('credit card with $500 owed → expense tx → balance = -500', () => {
    const opening = openingBalanceTx('credit_card', 500)
    expect(opening.type).toBe('expense')
    expect(opening.amount).toBe(500)
    expect(computeBalance([opening])).toBe(-500)
  })

  it('credit card with negative input (-$500) still → expense → balance = -500', () => {
    const opening = openingBalanceTx('credit_card', -500)
    expect(opening.type).toBe('expense')
    expect(opening.amount).toBe(500)
    expect(computeBalance([opening])).toBe(-500)
  })

  it('loan with $10000 → expense tx → balance = -10000', () => {
    const opening = openingBalanceTx('loan', 10000)
    expect(computeBalance([opening])).toBe(-10000)
  })
})

describe('opening balance + imported transactions', () => {
  it('checking: $1000 opening + $2500 income + $300 expense = $3200', () => {
    const rows: TxRow[] = [
      openingBalanceTx('checking', 1000),
      { type: 'income', amount: 2500, status: 'posted' },
      { type: 'expense', amount: 300, status: 'posted' }
    ]
    expect(computeBalance(rows)).toBe(3200)
  })

  it('credit card: $500 opening balance + $200 purchase + $300 payment = -$400', () => {
    const rows: TxRow[] = [
      openingBalanceTx('credit_card', 500),  // -500
      { type: 'expense', amount: 200, status: 'posted' }, // -200
      { type: 'income', amount: 300, status: 'posted' }   // +300 (payment)
    ]
    // -500 - 200 + 300 = -400
    expect(computeBalance(rows)).toBe(-400)
  })

  it('imported transactions (posted) count immediately — no manual review needed', () => {
    const rows: TxRow[] = [
      { type: 'expense', amount: 50, status: 'posted' },
      { type: 'expense', amount: 30, status: 'posted' }
    ]
    expect(computeBalance(rows)).toBe(-80)
  })
})

describe('net worth calculation', () => {
  function netWorth(accounts: { type: string; balance: number }[]): { assets: number; liabilities: number; net: number } {
    const liabilityTypes = new Set(['credit_card', 'loan', 'student_loan', 'liability'])
    let assets = 0
    let liabilities = 0
    for (const acc of accounts) {
      if (liabilityTypes.has(acc.type)) {
        liabilities += Math.abs(Math.min(acc.balance, 0))
      } else {
        assets += Math.max(acc.balance, 0)
      }
    }
    return { assets, liabilities, net: assets - liabilities }
  }

  it('checking $3000, savings $5000, CC -$500 → net worth $7500', () => {
    const result = netWorth([
      { type: 'checking', balance: 3000 },
      { type: 'savings', balance: 5000 },
      { type: 'credit_card', balance: -500 }
    ])
    expect(result.assets).toBe(8000)
    expect(result.liabilities).toBe(500)
    expect(result.net).toBe(7500)
  })

  it('CC with positive balance (credit) contributes 0 to liabilities', () => {
    const result = netWorth([{ type: 'credit_card', balance: 50 }])
    expect(result.liabilities).toBe(0)
  })
})
