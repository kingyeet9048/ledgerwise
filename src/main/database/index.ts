import Database from '@signalapp/better-sqlite3'
import * as argon2 from 'argon2'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { migrations } from './migrations'

let db: Database.Database | null = null

function getDataDir(): string {
  if (!app.isPackaged) {
    return app.getAppPath()
  }
  return app.getPath('userData')
}

function getKeyFilePath(): string {
  return path.join(getDataDir(), 'key.json')
}

function getDbPath(): string {
  return path.join(getDataDir(), 'ledgerwise.db')
}

export function isSetup(): boolean {
  return fs.existsSync(getKeyFilePath())
}

interface KeyFile {
  salt: string
  encryptedDEK: string
  iv: string
  authTag: string
}

async function deriveKEK(passphrase: string, saltHex: string): Promise<Buffer> {
  const salt = Buffer.from(saltHex, 'hex')
  const kek = await argon2.hash(passphrase, {
    type: argon2.argon2id,
    salt,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    hashLength: 32,
    raw: true
  })
  return kek as Buffer
}

function encryptDEK(dek: Buffer, kek: Buffer): { encryptedDEK: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv)
  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    encryptedDEK: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  }
}

function decryptDEK(encryptedDEK: string, iv: string, authTag: string, kek: Buffer): Buffer {
  const decipher = crypto.createDecipheriv('aes-256-gcm', kek, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedDEK, 'hex')),
    decipher.final()
  ])
  return decrypted
}

export async function setupDatabase(passphrase: string): Promise<void> {
  const dataDir = getDataDir()
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  // Generate random 32-byte DEK
  const dek = crypto.randomBytes(32)

  // Generate random salt
  const salt = crypto.randomBytes(32)
  const saltHex = salt.toString('hex')

  // Derive KEK from passphrase
  const kek = await deriveKEK(passphrase, saltHex)

  // Encrypt DEK with KEK
  const { encryptedDEK, iv, authTag } = encryptDEK(dek, kek)

  // Save key file
  const keyFile: KeyFile = { salt: saltHex, encryptedDEK, iv, authTag }
  fs.writeFileSync(getKeyFilePath(), JSON.stringify(keyFile), 'utf-8')

  // Open DB with DEK
  await openDatabaseWithKey(dek)
}

export async function unlockDatabase(passphrase: string): Promise<void> {
  const keyFilePath = getKeyFilePath()
  if (!fs.existsSync(keyFilePath)) {
    throw new Error('Database not initialized')
  }

  const keyFile: KeyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf-8'))

  // Derive KEK from passphrase
  const kek = await deriveKEK(passphrase, keyFile.salt)

  // Decrypt DEK
  let dek: Buffer
  try {
    dek = decryptDEK(keyFile.encryptedDEK, keyFile.iv, keyFile.authTag, kek)
  } catch {
    throw new Error('Wrong passphrase')
  }

  await openDatabaseWithKey(dek)
}

async function openDatabaseWithKey(dek: Buffer): Promise<void> {
  const dbPath = getDbPath()
  const dekHex = dek.toString('hex')

  const newDb = new Database(dbPath)
  newDb.pragma(`key = "x'${dekHex}'"`)
  newDb.pragma('temp_store = MEMORY')
  newDb.pragma('journal_mode = WAL')
  newDb.pragma('synchronous = FULL')
  newDb.pragma('foreign_keys = ON')

  db = newDb
  runMigrations()
}

function runMigrations(): void {
  if (!db) throw new Error('DB not open')

  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  const getApplied = db.prepare('SELECT version FROM migrations ORDER BY version')
  const applied = new Set((getApplied.all() as { version: number }[]).map((r) => r.version))

  const insertMigration = db.prepare(
    "INSERT INTO migrations (version, applied_at) VALUES (?, datetime('now'))"
  )

  for (const migration of migrations) {
    if (!applied.has(migration.version)) {
      db.exec(migration.sql)
      insertMigration.run(migration.version)
    }
  }
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database is not open')
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

export async function changePassphrase(oldPassphrase: string, newPassphrase: string): Promise<void> {
  const keyFilePath = getKeyFilePath()
  if (!fs.existsSync(keyFilePath)) {
    throw new Error('Database not initialized')
  }

  const keyFile: KeyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf-8'))

  // Verify old passphrase by deriving KEK and decrypting DEK
  const oldKEK = await deriveKEK(oldPassphrase, keyFile.salt)
  let dek: Buffer
  try {
    dek = decryptDEK(keyFile.encryptedDEK, keyFile.iv, keyFile.authTag, oldKEK)
  } catch {
    throw new Error('Wrong current passphrase')
  }

  // Generate new salt and re-encrypt DEK with new passphrase
  const newSalt = crypto.randomBytes(32)
  const newSaltHex = newSalt.toString('hex')
  const newKEK = await deriveKEK(newPassphrase, newSaltHex)
  const { encryptedDEK, iv, authTag } = encryptDEK(dek, newKEK)

  const newKeyFile: KeyFile = { salt: newSaltHex, encryptedDEK, iv, authTag }
  fs.writeFileSync(keyFilePath, JSON.stringify(newKeyFile), 'utf-8')
}

export function getDataDirectory(): string {
  return getDataDir()
}
