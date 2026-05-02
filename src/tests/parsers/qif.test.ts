import { describe, it, expect } from 'vitest'
import { parseQIF } from '../../main/parsers/qif'

const BANK_QIF = `!Type:Bank
D03/06/2026
T-30.39
PPIZZA HUT
MFood
^
D03/15/2026
T2500.00
PPAYROLL DEPOSIT
^
D03/21/2026
T-115.00
PCHASE PAYMENT
^`

const CCARD_QIF = `!Type:CCard
D03/06/2026
T-55.99
PAMAZON PURCHASE
^
D03/20/2026
T200.00
PPAYMENT RECEIVED
^`

const INVEST_QIF = `!Type:Invst
D03/01/2026
NBuy
YAAPL
I175.00
Q5
T-875.00
^
D03/10/2026
NSell
YMSFT
I320.00
Q3
T960.00
^
D03/15/2026
NDiv
YVTI
T12.50
^`

describe('parseQIF – bank account sign normalization', () => {
  it('stores all amounts as positive', () => {
    const txs = parseQIF(BANK_QIF)
    for (const tx of txs) {
      expect(tx.amount).toBeGreaterThan(0)
    }
  })

  it('negative T field → expense type', () => {
    const txs = parseQIF(BANK_QIF)
    const pizza = txs.find((t) => t.payee?.includes('PIZZA'))
    expect(pizza).toBeDefined()
    expect(pizza!.type).toBe('expense')
    expect(pizza!.amount).toBe(30.39)
  })

  it('positive T field → income type', () => {
    const txs = parseQIF(BANK_QIF)
    const payroll = txs.find((t) => t.payee?.includes('PAYROLL'))
    expect(payroll).toBeDefined()
    expect(payroll!.type).toBe('income')
    expect(payroll!.amount).toBe(2500.0)
  })
})

describe('parseQIF – credit card sign normalization', () => {
  it('stores all amounts as positive', () => {
    const txs = parseQIF(CCARD_QIF)
    for (const tx of txs) {
      expect(tx.amount).toBeGreaterThan(0)
    }
  })

  it('negative CCard amount → expense', () => {
    const txs = parseQIF(CCARD_QIF)
    const amazon = txs.find((t) => t.payee?.includes('AMAZON'))
    expect(amazon).toBeDefined()
    expect(amazon!.type).toBe('expense')
    expect(amazon!.amount).toBe(55.99)
  })

  it('positive CCard amount (payment) → income', () => {
    const txs = parseQIF(CCARD_QIF)
    const payment = txs.find((t) => t.payee?.includes('PAYMENT'))
    expect(payment).toBeDefined()
    expect(payment!.type).toBe('income')
    expect(payment!.amount).toBe(200.0)
  })
})

describe('parseQIF – investment actions', () => {
  it('Buy action → buy type with positive amount', () => {
    const txs = parseQIF(INVEST_QIF)
    const buy = txs.find((t) => t.type === 'buy')
    expect(buy).toBeDefined()
    expect(buy!.amount).toBeGreaterThan(0)
    expect(buy!.security_symbol).toBe('AAPL')
  })

  it('Sell action → sell type with positive amount', () => {
    const txs = parseQIF(INVEST_QIF)
    const sell = txs.find((t) => t.type === 'sell')
    expect(sell).toBeDefined()
    expect(sell!.amount).toBeGreaterThan(0)
  })

  it('Div action → dividend type', () => {
    const txs = parseQIF(INVEST_QIF)
    const div = txs.find((t) => t.type === 'dividend')
    expect(div).toBeDefined()
  })
})

describe('parseQIF – date formats', () => {
  it('parses MM/DD/YY with year > 50 as 19xx', () => {
    const qif = `!Type:Bank\nD03/06/99\nT-10.00\nPSomeStore\n^`
    const txs = parseQIF(qif)
    expect(txs[0].date).toBe('1999-03-06')
  })

  it('parses MM/DD/YY with year <= 50 as 20xx', () => {
    const qif = `!Type:Bank\nD03/06/26\nT-10.00\nPSomeStore\n^`
    const txs = parseQIF(qif)
    expect(txs[0].date).toBe('2026-03-06')
  })

  it('handles last record without trailing ^', () => {
    const qif = `!Type:Bank\nD03/06/2026\nT-10.00\nPLast Store`
    const txs = parseQIF(qif)
    expect(txs.length).toBe(1)
    expect(txs[0].payee).toBe('Last Store')
  })
})
