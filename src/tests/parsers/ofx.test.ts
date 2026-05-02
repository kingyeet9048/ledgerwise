import { describe, it, expect } from 'vitest'
import { parseOFX } from '../../main/parsers/ofx'

const OFX_BANK = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260306
<TRNAMT>-30.39
<FITID>20260306001
<NAME>PIZZA HUT
<MEMO>Food purchase
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260315
<TRNAMT>2500.00
<FITID>20260315001
<NAME>PAYROLL DIRECT DEPOSIT
</STMTTRN>
<STMTTRN>
<TRNTYPE>INT
<DTPOSTED>20260301
<TRNAMT>1.25
<FITID>20260301001
<NAME>INTEREST EARNED
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`

const OFX_CREDIT = `OFXHEADER:100
DATA:OFXSGML
<OFX>
<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<CCSTMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260310120000
<TRNAMT>-55.00
<FITID>CC20260310001
<NAME>NETFLIX
</STMTTRN>
<STMTTRN>
<TRNTYPE>PAYMENT
<DTPOSTED>20260321
<TRNAMT>200.00
<FITID>CC20260321001
<NAME>PAYMENT RECEIVED
</STMTTRN>
</BANKTRANLIST>
</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>
</OFX>`

describe('parseOFX – amount sign normalization', () => {
  it('stores all amounts as positive', () => {
    const txs = parseOFX(OFX_BANK)
    for (const tx of txs) {
      expect(tx.amount).toBeGreaterThan(0)
    }
  })

  it('DEBIT with negative TRNAMT → expense type', () => {
    const txs = parseOFX(OFX_BANK)
    const pizza = txs.find((t) => t.payee?.includes('PIZZA'))
    expect(pizza).toBeDefined()
    expect(pizza!.type).toBe('expense')
    expect(pizza!.amount).toBe(30.39)
  })

  it('CREDIT with positive TRNAMT → income type', () => {
    const txs = parseOFX(OFX_BANK)
    const payroll = txs.find((t) => t.payee?.includes('PAYROLL'))
    expect(payroll).toBeDefined()
    expect(payroll!.type).toBe('income')
    expect(payroll!.amount).toBe(2500.0)
  })

  it('INT type → interest', () => {
    const txs = parseOFX(OFX_BANK)
    const interest = txs.find((t) => t.payee?.includes('INTEREST'))
    expect(interest).toBeDefined()
    expect(interest!.type).toBe('interest')
    expect(interest!.amount).toBe(1.25)
  })

  it('preserves external_id from FITID', () => {
    const txs = parseOFX(OFX_BANK)
    const pizza = txs.find((t) => t.payee?.includes('PIZZA'))
    expect(pizza!.external_id).toBe('20260306001')
  })

  it('parses date with time component (YYYYMMDDHHMMSS)', () => {
    const txs = parseOFX(OFX_CREDIT)
    const netflix = txs.find((t) => t.payee?.includes('NETFLIX'))
    expect(netflix).toBeDefined()
    expect(netflix!.date).toBe('2026-03-10')
  })

  it('PAYMENT type → expense type (a payment reduces credit card balance)', () => {
    const txs = parseOFX(OFX_CREDIT)
    const payment = txs.find((t) => t.payee?.includes('PAYMENT'))
    expect(payment).toBeDefined()
    expect(payment!.type).toBe('expense')
    expect(payment!.amount).toBe(200.0)
  })

  it('credit card DEBIT with negative amount stored as positive expense', () => {
    const txs = parseOFX(OFX_CREDIT)
    const netflix = txs.find((t) => t.payee?.includes('NETFLIX'))
    expect(netflix!.type).toBe('expense')
    expect(netflix!.amount).toBe(55.0)
  })
})
