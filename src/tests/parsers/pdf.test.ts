import { describe, it, expect } from 'vitest'
import { extractChaseTransactions } from '../../main/parsers/pdf'

const SAMPLE_PDF_TEXT = `
CREDIT CARD ACCOUNT SUMMARY
Opening/Closing Date03/08/26 - 04/07/26
Statement Date 04/07/26

ACCOUNT ACTIVITY
Date of
Transaction Merchant Name or Transaction Description $ Amount
PAYMENTS AND OTHER CREDITS
03/21 Payment Thank You-Mobile -115.00
03/26 Payment Thank You - Bill Pay Service -836.37
PURCHASES
03/06 PIZZA HUT #7144 https://ipcha TX 30.39
03/08 H-E-B #476 AUSTIN TX 166.29
03/08 AMAZON PRIME*6N9G72X23 Amzn.com/bill WA 16.23
03/10 NETFLIX.COM 408-5403700 CA 17.99
04/01 WWW.GETSEQUENCE.IO GETSEQUENCE.I NY 15.99
04/05 McDonalds 22727 151-2836870 TX 14.38

ACCOUNT ACTIVITY (CONTINUED)
Date of
Transaction Merchant Name or Transaction Description $ Amount
04/03 SQ *ICHIUMI SUSHI (HARU S Austin TX 90.28
04/04 H-E-B #476 AUSTIN TX 125.82
04/05 TACO BELL #030088 AUSTIN TX 13.92

Total fees charged in 2026 $0.00
INTEREST CHARGES
`

describe('extractChaseTransactions', () => {
  it('parses transactions from both ACCOUNT ACTIVITY sections', () => {
    const txs = extractChaseTransactions(SAMPLE_PDF_TEXT)
    expect(txs.length).toBeGreaterThanOrEqual(11)
  })

  it('captures transactions from ACCOUNT ACTIVITY (CONTINUED) section', () => {
    const txs = extractChaseTransactions(SAMPLE_PDF_TEXT)
    const continuedTx = txs.find((t) => t.payee?.includes('ICHIUMI') || t.payee?.includes('TACO BELL'))
    expect(continuedTx).toBeDefined()
  })

  it('maps negative amounts to income type (Chase payments)', () => {
    const txs = extractChaseTransactions(SAMPLE_PDF_TEXT)
    const payment = txs.find((t) => t.payee?.includes('Payment Thank You'))
    expect(payment).toBeDefined()
    expect(payment!.type).toBe('income')
    expect(payment!.amount).toBeGreaterThan(0)
  })

  it('maps positive amounts to expense type (purchases)', () => {
    const txs = extractChaseTransactions(SAMPLE_PDF_TEXT)
    const pizza = txs.find((t) => t.payee?.includes('PIZZA HUT'))
    expect(pizza).toBeDefined()
    expect(pizza!.type).toBe('expense')
    expect(pizza!.amount).toBe(30.39)
  })

  it('stores amounts as positive (Math.abs)', () => {
    const txs = extractChaseTransactions(SAMPLE_PDF_TEXT)
    for (const tx of txs) {
      expect(tx.amount).toBeGreaterThan(0)
    }
  })

  it('assigns correct year from Opening/Closing Date header', () => {
    const txs = extractChaseTransactions(SAMPLE_PDF_TEXT)
    const marchTx = txs.find((t) => t.date.startsWith('2026-03'))
    const aprilTx = txs.find((t) => t.date.startsWith('2026-04'))
    expect(marchTx).toBeDefined()
    expect(aprilTx).toBeDefined()
  })

  it('strips trailing 2-letter state codes from payee', () => {
    const txs = extractChaseTransactions(SAMPLE_PDF_TEXT)
    const heb = txs.find((t) => t.payee?.includes('H-E-B'))
    expect(heb).toBeDefined()
    expect(heb!.payee).not.toMatch(/\s[A-Z]{2}$/)
  })

  it('deduplicates identical transactions', () => {
    const doubled = SAMPLE_PDF_TEXT + '\n03/08 H-E-B #476 AUSTIN TX 166.29\n'
    const txs = extractChaseTransactions(doubled)
    const hebs = txs.filter((t) => t.payee?.includes('H-E-B') && t.amount === 166.29)
    expect(hebs.length).toBe(1)
  })

  it('does not capture header or summary lines', () => {
    const txs = extractChaseTransactions(SAMPLE_PDF_TEXT)
    const garbage = txs.find(
      (t) =>
        t.payee?.match(/^(ACCOUNT ACTIVITY|Date of|Merchant Name|PURCHASES|PAYMENTS)/i)
    )
    expect(garbage).toBeUndefined()
  })

  it('does not capture transactions after stop marker', () => {
    const txs = extractChaseTransactions(SAMPLE_PDF_TEXT)
    const afterStop = txs.find((t) => t.payee?.match(/INTEREST/i))
    expect(afterStop).toBeUndefined()
  })

  it('handles transactions with phone numbers in description', () => {
    const txs = extractChaseTransactions(SAMPLE_PDF_TEXT)
    const netflix = txs.find((t) => t.payee?.includes('NETFLIX'))
    expect(netflix).toBeDefined()
    expect(netflix!.amount).toBe(17.99)
  })

  it('handles transactions with URLs in description', () => {
    const txs = extractChaseTransactions(SAMPLE_PDF_TEXT)
    const seq = txs.find((t) => t.payee?.includes('GETSEQUENCE') || t.payee?.includes('WWW.GETSEQUENCE'))
    expect(seq).toBeDefined()
    expect(seq!.amount).toBe(15.99)
  })

  it('handles year boundary: prior-year transactions on Jan statement', () => {
    const janText = `
Opening/Closing Date12/08/25 - 01/07/26
ACCOUNT ACTIVITY
12/15 SOME STORE TX 50.00
01/03 OTHER STORE TX 25.00
`
    const txs = extractChaseTransactions(janText)
    const dec = txs.find((t) => t.date.startsWith('2025-12'))
    const jan = txs.find((t) => t.date.startsWith('2026-01'))
    expect(dec).toBeDefined()
    expect(jan).toBeDefined()
  })

  it('returns empty array for text with no transactions', () => {
    const txs = extractChaseTransactions('just some random text\nno transactions here')
    expect(txs).toEqual([])
  })
})
