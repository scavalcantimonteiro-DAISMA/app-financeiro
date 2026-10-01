const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const config = require('../config');

let db = null;

function getDatabase() {
  if (!db) {
    db = new DatabaseSync(config.DB_PATH);
    initTables(db);
  }
  return db;
}

function initTables(database) {
  // Configurações do App (Pix, Nome, etc.)
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Inserir configurações padrão se não existirem
  const checkSettings = database.prepare("SELECT value FROM app_settings WHERE key = 'user_name'").get();
  if (!checkSettings) {
    database.prepare("INSERT INTO app_settings (key, value) VALUES ('user_name', 'Saulo')").run();
    database.prepare("INSERT INTO app_settings (key, value) VALUES ('pix_key', '06888505456')").run();
  }

  // Rendas / Entradas
  database.exec(`
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

  // Contas Fixas Recorrentes
  database.exec(`
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

  // Pagamentos mensais das Contas Fixas
  database.exec(`
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

  // Gastos Variáveis / Despesas Diárias
  database.exec(`
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

  // Devedores (Pessoas que me devem)
  database.exec(`
    CREATE TABLE IF NOT EXISTS debtors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Dívidas / Compras de cada devedor
  database.exec(`
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

  // Parcelas individuais da dívida
  database.exec(`
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

  // Migrações seguras de schema para bancos existentes
  try {
    const expensesCols = database.prepare("PRAGMA table_info(expenses)").all().map(c => c.name);
    if (!expensesCols.includes('payment_method')) {
      database.exec("ALTER TABLE expenses ADD COLUMN payment_method TEXT DEFAULT 'Pix'");
    }

    const fixedTableInfo = database.prepare("PRAGMA table_info(fixed_expenses)").all();
    const fixedCols = fixedTableInfo.map(c => c.name);
    const yearCol = fixedTableInfo.find(c => c.name === 'year');
    
    // Se a tabela antiga tinha 'year' como NOT NULL, recriar limpa
    if (yearCol && yearCol.notnull === 1) {
      database.exec(`
        PRAGMA foreign_keys=OFF;
        CREATE TABLE IF NOT EXISTS fixed_expenses_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          due_day INTEGER DEFAULT 10,
          category TEXT DEFAULT 'Moradia',
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now', 'localtime'))
        );
        INSERT OR IGNORE INTO fixed_expenses_new (id, name, amount, due_day, category, is_active, created_at)
        SELECT id, name, amount, 10, 'Moradia', 1, created_at FROM fixed_expenses;
        DROP TABLE fixed_expenses;
        ALTER TABLE fixed_expenses_new RENAME TO fixed_expenses;
        PRAGMA foreign_keys=ON;
      `);
    } else {
      if (!fixedCols.includes('due_day')) {
        database.exec("ALTER TABLE fixed_expenses ADD COLUMN due_day INTEGER DEFAULT 10");
      }
      if (!fixedCols.includes('category')) {
        database.exec("ALTER TABLE fixed_expenses ADD COLUMN category TEXT DEFAULT 'Moradia'");
      }
      if (!fixedCols.includes('is_active')) {
        database.exec("ALTER TABLE fixed_expenses ADD COLUMN is_active INTEGER DEFAULT 1");
      }
    }
  } catch (err) {
    console.error('Aviso ao aplicar migrações:', err.message);
  }
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDatabase,
  closeDatabase
};
