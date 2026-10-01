const { getDatabase } = require('./db');

// --- Configurações ---
function getSettings() {
  const db = getDatabase();
  const rows = db.prepare('SELECT key, value FROM app_settings').all();
  const settings = {
    user_name: 'Saulo',
    pix_key: '06888505456'
  };
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  return settings;
}

function updateSetting(key, value) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO app_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

// --- Rendas ---
function getIncomesByMonth(year, month) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM incomes 
    WHERE year = ? AND month = ?
    ORDER BY id DESC
  `).all(year, month);
}

function addIncome(year, month, description, amount, receivedDate) {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO incomes (year, month, description, amount, received_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(year, month, description, amount, receivedDate || null);
  return { id: result.lastInsertRowid, year, month, description, amount };
}

function deleteIncome(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM incomes WHERE id = ?').run(id);
}

// --- Contas Fixas ---
function getFixedExpensesWithStatus(year, month) {
  const db = getDatabase();
  const expenses = db.prepare(`
    SELECT fe.*, 
      COALESCE(fep.is_paid, 0) as is_paid,
      fep.paid_at
    FROM fixed_expenses fe
    LEFT JOIN fixed_expense_payments fep 
      ON fe.id = fep.fixed_expense_id AND fep.year = ? AND fep.month = ?
    WHERE fe.is_active = 1
    ORDER BY fe.due_day ASC, fe.name ASC
  `).all(year, month);
  return expenses;
}

function addFixedExpense(name, amount, dueDay, category) {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO fixed_expenses (name, amount, due_day, category)
    VALUES (?, ?, ?, ?)
  `).run(name, amount, dueDay || 10, category || 'Moradia');
  return { id: result.lastInsertRowid, name, amount, dueDay, category };
}

function updateFixedExpense(id, name, amount, dueDay, category) {
  const db = getDatabase();
  db.prepare(`
    UPDATE fixed_expenses
    SET name = ?, amount = ?, due_day = ?, category = ?
    WHERE id = ?
  `).run(name, amount, dueDay, category, id);
}

function deleteFixedExpense(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM fixed_expenses WHERE id = ?').run(id);
  db.prepare('DELETE FROM fixed_expense_payments WHERE fixed_expense_id = ?').run(id);
}

function toggleFixedExpensePayment(fixedExpenseId, year, month, isPaid) {
  const db = getDatabase();
  const paidAt = isPaid ? new Date().toISOString() : null;
  db.prepare(`
    INSERT INTO fixed_expense_payments (fixed_expense_id, year, month, is_paid, paid_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(fixed_expense_id, year, month)
    DO UPDATE SET is_paid = excluded.is_paid, paid_at = excluded.paid_at
  `).run(fixedExpenseId, year, month, isPaid ? 1 : 0, paidAt);
}

// --- Gastos Variáveis / Despesas ---
function addExpense(description, amount, category, dateStr, paymentMethod) {
  const db = getDatabase();
  const dateObj = new Date(dateStr + 'T12:00:00');
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;

  const result = db.prepare(`
    INSERT INTO expenses (description, amount, category, date_str, year, month, payment_method)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(description, amount, category || 'Outros', dateStr, year, month, paymentMethod || 'Pix');

  return {
    id: result.lastInsertRowid,
    description,
    amount,
    category: category || 'Outros',
    dateStr,
    year,
    month,
    paymentMethod: paymentMethod || 'Pix'
  };
}

function updateExpense(id, description, amount, category, dateStr, paymentMethod) {
  const db = getDatabase();
  const dateObj = new Date(dateStr + 'T12:00:00');
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;

  db.prepare(`
    UPDATE expenses 
    SET description = ?, amount = ?, category = ?, date_str = ?, year = ?, month = ?, payment_method = ?
    WHERE id = ?
  `).run(description, amount, category, dateStr, year, month, paymentMethod, id);

  return { id, description, amount, category, dateStr, year, month, paymentMethod };
}

function deleteExpense(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
}

function getExpensesByMonth(year, month) {
  const db = getDatabase();
  const items = db.prepare(`
    SELECT * FROM expenses
    WHERE year = ? AND month = ?
    ORDER BY date_str DESC, id DESC
  `).all(year, month);

  const totalRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE year = ? AND month = ?
  `).get(year, month);

  return {
    items,
    total: totalRow ? totalRow.total : 0
  };
}

function getAllExpenses(year = null, month = null) {
  const db = getDatabase();
  let query = 'SELECT * FROM expenses';
  const params = [];
  if (year && month) {
    query += ' WHERE year = ? AND month = ?';
    params.push(year, month);
  }
  query += ' ORDER BY date_str DESC, id DESC';
  return db.prepare(query).all(...params);
}

// --- Devedores & Parcelas ---
function addDebtor(name, phone, notes) {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO debtors (name, phone, notes)
    VALUES (?, ?, ?)
  `).run(name, phone || '', notes || '');
  return { id: result.lastInsertRowid, name, phone, notes };
}

function updateDebtor(id, name, phone, notes) {
  const db = getDatabase();
  db.prepare(`
    UPDATE debtors
    SET name = ?, phone = ?, notes = ?
    WHERE id = ?
  `).run(name, phone || '', notes || '', id);
}

function deleteDebtor(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM debt_installments WHERE debtor_id = ?').run(id);
  db.prepare('DELETE FROM debt_items WHERE debtor_id = ?').run(id);
  db.prepare('DELETE FROM debtors WHERE id = ?').run(id);
}

function addDebtItem(debtorId, description, totalAmount, installmentsCount, startDateStr) {
  const db = getDatabase();
  const count = parseInt(installmentsCount, 10) || 1;
  const itemResult = db.prepare(`
    INSERT INTO debt_items (debtor_id, description, total_amount, installments_count, start_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(debtorId, description, totalAmount, count, startDateStr);

  const debtItemId = itemResult.lastInsertRowid;
  const installmentAmount = Math.round((totalAmount / count) * 100) / 100;
  // Ajuste de centavos na última parcela se houver dízima
  const remainder = Math.round((totalAmount - (installmentAmount * count)) * 100) / 100;

  const startDate = new Date(startDateStr + 'T12:00:00');
  
  for (let i = 1; i <= count; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + (i - 1));
    const dueYear = dueDate.getFullYear();
    const dueMonth = dueDate.getMonth() + 1;
    const dueDay = String(dueDate.getDate()).padStart(2, '0');
    const dueDateStr = `${dueYear}-${String(dueMonth).padStart(2, '0')}-${dueDay}`;

    const amount = (i === count) ? (installmentAmount + remainder) : installmentAmount;

    db.prepare(`
      INSERT INTO debt_installments (
        debt_item_id, debtor_id, installment_number, total_installments, 
        amount, due_date, due_year, due_month, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `).run(debtItemId, debtorId, i, count, amount, dueDateStr, dueYear, dueMonth);
  }

  return { debtItemId, debtorId, description, totalAmount, count };
}

function deleteDebtItem(debtItemId) {
  const db = getDatabase();
  db.prepare('DELETE FROM debt_installments WHERE debt_item_id = ?').run(debtItemId);
  db.prepare('DELETE FROM debt_items WHERE id = ?').run(debtItemId);
}

function setInstallmentStatus(installmentId, isPaid) {
  const db = getDatabase();
  const status = isPaid ? 'PAID' : 'PENDING';
  const paidAt = isPaid ? new Date().toISOString() : null;
  db.prepare(`
    UPDATE debt_installments
    SET status = ?, paid_at = ?
    WHERE id = ?
  `).run(status, paidAt, installmentId);
}

function payAllDebtorInstallments(debtorId) {
  const db = getDatabase();
  const paidAt = new Date().toISOString();
  db.prepare(`
    UPDATE debt_installments
    SET status = 'PAID', paid_at = ?
    WHERE debtor_id = ? AND status = 'PENDING'
  `).run(paidAt, debtorId);
}

// Obter devedores com resumo completo de valores
function getAllDebtorsSummary() {
  const db = getDatabase();
  const debtors = db.prepare(`
    SELECT d.*,
      COALESCE((SELECT SUM(amount) FROM debt_installments WHERE debtor_id = d.id), 0) as total_debt,
      COALESCE((SELECT SUM(amount) FROM debt_installments WHERE debtor_id = d.id AND status = 'PAID'), 0) as total_paid,
      COALESCE((SELECT SUM(amount) FROM debt_installments WHERE debtor_id = d.id AND status = 'PENDING'), 0) as total_pending
    FROM debtors d
    ORDER BY total_pending DESC, d.name ASC
  `).all();

  for (const debtor of debtors) {
    debtor.items = db.prepare(`
      SELECT di.*,
        (SELECT COUNT(*) FROM debt_installments WHERE debt_item_id = di.id AND status = 'PAID') as paid_count
      FROM debt_items di
      WHERE di.debtor_id = ?
      ORDER BY di.id DESC
    `).all(debtor.id);

    for (const item of debtor.items) {
      item.installments = db.prepare(`
        SELECT * FROM debt_installments
        WHERE debt_item_id = ?
        ORDER BY installment_number ASC
      `).all(item.id);
    }
  }

  return debtors;
}

// BUSCA AUTOMÁTICA DE VALORES A RECEBER NO MÊS
// Esta função é o coração do preenchimento automático solicitado pelo Saulo:
// Puxa nome da pessoa, descrição da compra, parcela atual e valor de todas as cobranças daquele mês!
function getReceivablesForMonth(year, month) {
  const db = getDatabase();
  return db.prepare(`
    SELECT 
      inst.id as installment_id,
      inst.installment_number,
      inst.total_installments,
      inst.amount,
      inst.due_date,
      inst.status,
      inst.paid_at,
      d.id as debtor_id,
      d.name as debtor_name,
      d.phone as debtor_phone,
      item.id as debt_item_id,
      item.description as item_description
    FROM debt_installments inst
    JOIN debtors d ON inst.debtor_id = d.id
    JOIN debt_items item ON inst.debt_item_id = item.id
    WHERE inst.due_year = ? AND inst.due_month = ?
    ORDER BY inst.status ASC, inst.due_date ASC, d.name ASC
  `).all(year, month);
}

// Histórico de valores a receber por mês (para gráficos de comparativo)
function getReceivablesMonthlyStats() {
  const db = getDatabase();
  return db.prepare(`
    SELECT 
      due_year as year,
      due_month as month,
      COALESCE(SUM(amount), 0) as total_expected,
      COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) as total_received,
      COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) as total_pending
    FROM debt_installments
    GROUP BY due_year, due_month
    ORDER BY due_year ASC, due_month ASC
  `).all();
}

// Histórico mensal de despesas (para gráficos de consumo comparativo)
function getExpensesMonthlyStats() {
  const db = getDatabase();
  return db.prepare(`
    SELECT 
      year,
      month,
      COALESCE(SUM(amount), 0) as total
    FROM expenses
    GROUP BY year, month
    ORDER BY year ASC, month ASC
  `).all();
}

// Gastos por categoria em um determinado mês
function getExpensesByCategory(year, month) {
  const db = getDatabase();
  return db.prepare(`
    SELECT 
      category,
      COALESCE(SUM(amount), 0) as total,
      COUNT(*) as count
    FROM expenses
    WHERE year = ? AND month = ?
    GROUP BY category
    ORDER BY total DESC
  `).all(year, month);
}

module.exports = {
  getSettings,
  updateSetting,
  getIncomesByMonth,
  addIncome,
  deleteIncome,
  getFixedExpensesWithStatus,
  addFixedExpense,
  updateFixedExpense,
  deleteFixedExpense,
  toggleFixedExpensePayment,
  addExpense,
  updateExpense,
  deleteExpense,
  getExpensesByMonth,
  getAllExpenses,
  addDebtor,
  updateDebtor,
  deleteDebtor,
  addDebtItem,
  deleteDebtItem,
  setInstallmentStatus,
  payAllDebtorInstallments,
  getAllDebtorsSummary,
  getReceivablesForMonth,
  getReceivablesMonthlyStats,
  getExpensesMonthlyStats,
  getExpensesByCategory
};
