const { createClient } = require('@libsql/client');
require('dotenv').config();

const url = process.env.TURSO_DATABASE_URL || 'libsql://financeiro-scavalcantimonteiro-daisma.aws-sa-east-1.turso.io';
const authToken = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTA4Nzg2NjksImlkIjoiMDFhMGY4YWUtNTQwMS03MDljLWE3MjYtY2M5YjM3MmE3NjYxIiwia2lkIjoiSU5vcEJUVzVrMk0yQlZiTDlIcG1iMnNjSkw5bEF1OWpoSlZ1a2pZemRjTSIsInJpZCI6Ijc1ZWFhYWNiLTU4ZTktNDg0Yy05NzY1LTQ3MTI4ZjZkN2NkYyJ9.XKrmhYyNegyRvJCNhdVyu7eUBn9h4sCg8FsqKj6mLqyP0CM02KhBcy-fAuOEqbOPZxPUnpb5PvIUcx5sV2M8BA';

const client = createClient({ url, authToken });

async function initTurso() {
  console.log('🚀 Inicializando tabelas no Turso Cloud...');

  // 1. app_settings
  await client.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await client.execute({
    sql: "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('user_name', 'Saulo'), ('pix_key', '06888505456');",
    args: []
  });

  // 2. incomes
  await client.execute(`
    CREATE TABLE IF NOT EXISTS incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      received_date TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 3. fixed_expenses
  await client.execute(`
    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      due_day INTEGER DEFAULT 10,
      category TEXT DEFAULT 'Moradia',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 4. fixed_expense_payments
  await client.execute(`
    CREATE TABLE IF NOT EXISTS fixed_expense_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixed_expense_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      is_paid INTEGER NOT NULL DEFAULT 0,
      paid_at TEXT,
      UNIQUE(fixed_expense_id, year, month),
      FOREIGN KEY(fixed_expense_id) REFERENCES fixed_expenses(id) ON DELETE CASCADE
    );
  `);

  // 5. expenses
  await client.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date_str TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      payment_method TEXT DEFAULT 'Pix',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 6. debtors
  await client.execute(`
    CREATE TABLE IF NOT EXISTS debtors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 7. debt_items
  await client.execute(`
    CREATE TABLE IF NOT EXISTS debt_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debtor_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      total_amount REAL NOT NULL,
      installments_count INTEGER NOT NULL DEFAULT 1,
      start_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(debtor_id) REFERENCES debtors(id) ON DELETE CASCADE
    );
  `);

  // 8. debt_installments
  await client.execute(`
    CREATE TABLE IF NOT EXISTS debt_installments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_item_id INTEGER NOT NULL,
      debtor_id INTEGER NOT NULL,
      installment_number INTEGER NOT NULL,
      total_installments INTEGER NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      due_year INTEGER NOT NULL,
      due_month INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      paid_at TEXT,
      FOREIGN KEY(debt_item_id) REFERENCES debt_items(id) ON DELETE CASCADE,
      FOREIGN KEY(debtor_id) REFERENCES debtors(id) ON DELETE CASCADE
    );
  `);

  console.log('✅ Todas as tabelas criadas no Turso com sucesso!');

  // Copiar dados existentes de financeiro.db se houver
  try {
    const { DatabaseSync } = require('node:sqlite');
    const path = require('node:path');
    const localDbPath = path.join(__dirname, '..', '..', 'financeiro.db');
    const localDb = new DatabaseSync(localDbPath);

    // Contas Fixas
    const localFixed = localDb.prepare('SELECT * FROM fixed_expenses').all();
    for (const f of localFixed) {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO fixed_expenses (id, name, amount, due_day, category, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [f.id, f.name, f.amount, f.due_day || 10, f.category || 'Moradia', f.is_active || 1, f.created_at]
      });
    }

    // Devedores
    const localDebtors = localDb.prepare('SELECT * FROM debtors').all();
    for (const d of localDebtors) {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO debtors (id, name, phone, notes, created_at) VALUES (?, ?, ?, ?, ?)',
        args: [d.id, d.name, d.phone || '', d.notes || '', d.created_at]
      });
    }

    // Dívidas
    const localDebtItems = localDb.prepare('SELECT * FROM debt_items').all();
    for (const item of localDebtItems) {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO debt_items (id, debtor_id, description, total_amount, installments_count, start_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [item.id, item.debtor_id, item.description, item.total_amount, item.installments_count, item.start_date, item.created_at]
      });
    }

    // Parcelas
    const localInstallments = localDb.prepare('SELECT * FROM debt_installments').all();
    for (const inst of localInstallments) {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO debt_installments (id, debt_item_id, debtor_id, installment_number, total_installments, amount, due_date, due_year, due_month, status, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [inst.id, inst.debt_item_id, inst.debtor_id, inst.installment_number, inst.total_installments, inst.amount, inst.due_date, inst.due_year, inst.due_month, inst.status, inst.paid_at]
      });
    }

    // Despesas
    const localExpenses = localDb.prepare('SELECT * FROM expenses').all();
    for (const e of localExpenses) {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO expenses (id, category, description, amount, date_str, year, month, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [e.id, e.category, e.description, e.amount, e.date_str, e.year, e.month, e.payment_method || 'Pix', e.created_at]
      });
    }

    console.log(`📦 Dados sincronizados para o Turso Cloud: ${localFixed.length} contas fixas, ${localDebtors.length} devedores, ${localExpenses.length} despesas.`);
  } catch (err) {
    console.log('Sincronização de dados locais ignorada ou finalizada:', err.message);
  }
}

initTurso().then(() => {
  console.log('🎉 BANCO TURSO 100% OPERACIONAL!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Erro ao inicializar Turso:', err);
  process.exit(1);
});
