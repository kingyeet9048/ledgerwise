import { describe, it, expect } from 'vitest'
import { parseCSV } from '../../main/parsers/csv'

const CHASE_CREDIT_CSV = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
03/06/2026,03/07/2026,PIZZA HUT #7144,Food & Drink,Sale,-30.39,
03/08/2026,03/09/2026,H-E-B #476,Groceries,Sale,-166.29,
03/21/2026,03/22/2026,Payment Thank You-Mobile,Payment,Payment,115.00,
03/26/2026,03/27/2026,AMAZON PRIME,Shopping,Sale,-16.23,`

const CHASE_CHECKING_CSV = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,03/06/2026,PIZZA HUT,"-30.39",DEBIT_CARD,1200.00,
CREDIT,03/15/2026,PAYROLL DEPOSIT,"2500.00",ACH_CREDIT,3700.00,`

const GENERIC_CSV = `date,description,amount
2026-03-01,Coffee Shop,-4.50
2026-03-02,Salary,3000.00`

describe('parseCSV – amount sign normalization', () => {
  it('Chase Credit: stores amounts as positive regardless of CSV sign', () => {
    const txs = parseCSV(CHASE_CREDIT_CSV, 'chase_credit')
    for (const tx of txs) {
      expect(tx.amount).toBeGreaterThan(0)
    }
  })

  it('Chase Credit: negative CSV amount → expense type', () => {
    const txs = parseCSV(CHASE_CREDIT_CSV, 'chase_credit')
    const pizza = txs.find((t) => t.payee?.includes('PIZZA HUT'))
    expect(pizza).toBeDefined()
    expect(pizza!.type).toBe('expense')
    expect(pizza!.amount).toBe(30.39)
  })

  it('Chase Credit: positive CSV amount (payment) → income type', () => {
    const txs = parseCSV(CHASE_CREDIT_CSV, 'chase_credit')
    const payment = txs.find((t) => t.payee?.includes('Payment'))
    expect(payment).toBeDefined()
    expect(payment!.type).toBe('income')
    expect(payment!.amount).toBe(115.0)
  })

  it('Chase Checking: debit → expense with positive amount', () => {
    const txs = parseCSV(CHASE_CHECKING_CSV, 'chase')
    const debit = txs.find((t) => t.payee?.includes('PIZZA'))
    expect(debit).toBeDefined()
    expect(debit!.type).toBe('expense')
    expect(debit!.amount).toBe(30.39)
  })

  it('Chase Checking: credit → income with positive amount', () => {
    const txs = parseCSV(CHASE_CHECKING_CSV, 'chase')
    const credit = txs.find((t) => t.payee?.includes('PAYROLL'))
    expect(credit).toBeDefined()
    expect(credit!.type).toBe('income')
    expect(credit!.amount).toBe(2500.0)
  })

  it('auto-detects Chase Credit Card template from headers', () => {
    const txs = parseCSV(CHASE_CREDIT_CSV)
    expect(txs.length).toBeGreaterThan(0)
    const pizza = txs.find((t) => t.payee?.includes('PIZZA HUT'))
    expect(pizza).toBeDefined()
    expect(pizza!.amount).toBe(30.39)
  })

  it('generic CSV: amounts normalized to positive', () => {
    const txs = parseCSV(GENERIC_CSV)
    for (const tx of txs) {
      expect(tx.amount).toBeGreaterThan(0)
    }
  })

  it('generic CSV: negative amount → expense', () => {
    const txs = parseCSV(GENERIC_CSV)
    const coffee = txs.find((t) => t.payee?.includes('Coffee'))
    expect(coffee).toBeDefined()
    expect(coffee!.type).toBe('expense')
  })

  it('generic CSV: positive amount → income', () => {
    const txs = parseCSV(GENERIC_CSV)
    const salary = txs.find((t) => t.payee?.includes('Salary'))
    expect(salary).toBeDefined()
    expect(salary!.type).toBe('income')
  })

  it('skips rows with zero amount', () => {
    const csv = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n03/01/2026,03/02/2026,Zero Fee,Fees,Sale,0.00,`
    const txs = parseCSV(csv, 'chase_credit')
    expect(txs.length).toBe(0)
  })

  it('parses Robinhood buy transaction', () => {
    const csv = `Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
03/01/2026,03/03/2026,03/03/2026,AAPL,Apple Inc,Buy,5,175.00,-875.00`
    const txs = parseCSV(csv, 'robinhood')
    expect(txs.length).toBe(1)
    expect(txs[0].type).toBe('buy')
    expect(txs[0].amount).toBeGreaterThan(0)
  })
})

describe('parseCSV – Wells Fargo auto-detection', () => {
  const WF_CSV = `"03/01/2026","-50.00","*","","WHOLE FOODS MARKET"
"03/02/2026","2500.00","*","","DIRECT DEPOSIT"`

  it('detects Wells Fargo format when institution is specified', () => {
    const txs = parseCSV(WF_CSV, 'wells_fargo')
    expect(txs.length).toBe(2)
  })

  it('Wells Fargo: negative amount → expense with positive stored amount', () => {
    const txs = parseCSV(WF_CSV, 'wells_fargo')
    const wf = txs.find((t) => t.payee?.includes('WHOLE FOODS'))
    expect(wf).toBeDefined()
    expect(wf!.type).toBe('expense')
    expect(wf!.amount).toBe(50.0)
  })
})
