import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database'

const LIABILITY_TYPES = new Set(['credit_card', 'loan', 'student_loan', 'liability'])

/**
 * Recalculates an account's balance from its non-pending transactions and
 * persists the result to accounts.balance.
 */
export function recalcAccountBalance(db: ReturnType<typeof getDb>, accountId: string): void {
  const result = db
    .prepare(
      `SELECT COALESCE(SUM(
          CASE
            WHEN type IN ('income','dividend','interest') THEN amount
            WHEN type IN ('expense','fee')                THEN -amount
            WHEN type = 'buy'                             THEN -amount
            WHEN type = 'sell'                            THEN amount
            ELSE amount
          END
       ), 0) as balance
       FROM transactions
       WHERE account_id = ? AND status != 'pending'`
    )
    .get(accountId) as { balance: number }

  db.prepare('UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?').run(
    result.balance,
    new Date().toISOString(),
    accountId
  )
}

/**
 * Creates or replaces the single "Opening Balance" synthetic transaction for an
 * account so that the computed balance always starts from the user's stated value.
 *
 * - Asset accounts: positive opening → income transaction (adds to balance)
 * - Liability accounts (CC, loan, …): opening represents what is owed →
 *   expense transaction (subtracts, making balance negative as expected)
 */
export function upsertOpeningBalance(
  db: ReturnType<typeof getDb>,
  accountId: string,
  accountType: string,
  balance: number
): void {
  db.prepare(
    "DELETE FROM transactions WHERE account_id = ? AND source_parser = 'opening_balance'"
  ).run(accountId)

  const absBalance = Math.abs(balance)
  if (absBalance < 0.01) return

  const isLiability = LIABILITY_TYPES.has(accountType)
  const txType = isLiability ? 'expense' : balance >= 0 ? 'income' : 'expense'
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO transactions
     (id, account_id, date, amount, currency, payee, type, status, source_parser, is_split, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'USD', 'Opening Balance', ?, 'posted', 'opening_balance', 0, ?, ?)`
  ).run(uuidv4(), accountId, now.split('T')[0], absBalance, txType, now, now)
}
