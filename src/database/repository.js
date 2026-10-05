const { getDatabase } = require('./db');

// --- Configurações ---
async function getSettings() {
  const db = getDatabase();
  const res = await db.execute('SELECT key, value FROM app_settings');
  const settings = {
    user_name: 'Saulo',
    pix_key: '06888505456'
  };
  for (const r of res.rows) {
    settings[r.key] = r.value;
  }
  return settings;
}

async function updateSetting(key, value) {
  const db = getDatabase();
  await db.execute({
    sql: `INSERT INTO app_settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [key, value]
  });
}

// --- Rendas ---
async function getIncomesByMonth(year, month) {
  const db = getDatabase();
  const res = await db.execute({
    sql: 'SELECT * FROM incomes WHERE year = ? AND month = ? ORDER BY id DESC',
    args: [year, month]
  });
  return res.rows;
}

async function addIncome(year, month, description, amount, receivedDate) {
  const db = getDatabase();
  const res = await db.execute({
    sql: 'INSERT INTO incomes (year, month, description, amount, received_date) VALUES (?, ?, ?, ?, ?)',
    args: [year, month, description, amount, receivedDate || null]
  });
  return { id: Number(res.lastInsertRowid), year, month, description, amount };
}

async function deleteIncome(id) {
  const db = getDatabase();
  await db.execute({ sql: 'DELETE FROM incomes WHERE id = ?', args: [id] });
}

// --- Contas Fixas ---
async function getFixedExpensesWithStatus(year, month) {
  const db = getDatabase();
  const res = await db.execute({
    sql: `SELECT fe.*, 
            COALESCE(fep.is_paid, 0) as is_paid,
            fep.paid_at
          FROM fixed_expenses fe
          LEFT JOIN fixed_expense_payments fep 
            ON fe.id = fep.fixed_expense_id AND fep.year = ? AND fep.month = ?
          WHERE fe.is_active = 1
          ORDER BY fe.due_day ASC, fe.name ASC`,
    args: [year, month]
  });
  return res.rows;
}

async function addFixedExpense(name, amount, dueDay, category) {
  const db = getDatabase();
  const res = await db.execute({
    sql: 'INSERT INTO fixed_expenses (name, amount, due_day, category) VALUES (?, ?, ?, ?)',
    args: [name, amount, dueDay || 10, category || 'Moradia']
  });
  return { id: Number(res.lastInsertRowid), name, amount, dueDay, category };
}

async function updateFixedExpense(id, name, amount, dueDay, category) {
  const db = getDatabase();
  await db.execute({
    sql: 'UPDATE fixed_expenses SET name = ?, amount = ?, due_day = ?, category = ? WHERE id = ?',
    args: [name, amount, dueDay, category, id]
  });
}

async function deleteFixedExpense(id) {
  const db = getDatabase();
  await db.execute({ sql: 'DELETE FROM fixed_expenses WHERE id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM fixed_expense_payments WHERE fixed_expense_id = ?', args: [id] });
}

async function toggleFixedExpensePayment(fixedExpenseId, year, month, isPaid) {
  const db = getDatabase();
  const paidAt = isPaid ? new Date().toISOString() : null;
  await db.execute({
    sql: `INSERT INTO fixed_expense_payments (fixed_expense_id, year, month, is_paid, paid_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(fixed_expense_id, year, month)
          DO UPDATE SET is_paid = excluded.is_paid, paid_at = excluded.paid_at`,
    args: [fixedExpenseId, year, month, isPaid ? 1 : 0, paidAt]
  });
}

// --- Gastos Variáveis / Despesas ---
async function addExpense(description, amount, category, dateStr, paymentMethod, installmentsCount = 1) {
  const db = getDatabase();
  const count = parseInt(installmentsCount, 10) || 1;

  if (count <= 1) {
    const dateObj = new Date(dateStr + 'T12:00:00');
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;

    const res = await db.execute({
      sql: 'INSERT INTO expenses (description, amount, category, date_str, year, month, payment_method, installment_number, total_installments) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)',
      args: [description, amount, category || 'Outros', dateStr, year, month, paymentMethod || 'Pix']
    });

    return {
      id: Number(res.lastInsertRowid),
      description,
      amount,
      category: category || 'Outros',
      dateStr,
      year,
      month,
      paymentMethod: paymentMethod || 'Pix',
      installmentNumber: 1,
      totalInstallments: 1
    };
  }

  // Compra Parcelada no Cartão de Crédito (Distribui pelos próximos meses)
  const totalAmount = parseFloat(amount);
  const installmentAmount = Math.round((totalAmount / count) * 100) / 100;
  const remainder = Math.round((totalAmount - (installmentAmount * count)) * 100) / 100;
  const startDate = new Date(dateStr + 'T12:00:00');

  let firstExpense = null;
  let parentExpenseId = null;

  for (let i = 1; i <= count; i++) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + (i - 1));
    const dueYear = d.getFullYear();
    const dueMonth = d.getMonth() + 1;
    const dueDay = String(d.getDate()).padStart(2, '0');
    const dueDateStr = `${dueYear}-${String(dueMonth).padStart(2, '0')}-${dueDay}`;

    const currentAmount = (i === count) ? (installmentAmount + remainder) : installmentAmount;
    const installmentDesc = `${description} (${i}/${count})`;

    const res = await db.execute({
      sql: `INSERT INTO expenses (
              description, amount, category, date_str, year, month, 
              payment_method, installment_number, total_installments, parent_expense_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        installmentDesc,
        currentAmount,
        category || 'Outros',
        dueDateStr,
        dueYear,
        dueMonth,
        paymentMethod || 'Cartão de Crédito',
        i,
        count,
        parentExpenseId
      ]
    });

    const insertedId = Number(res.lastInsertRowid);
    if (i === 1) {
      parentExpenseId = insertedId;
      firstExpense = {
        id: insertedId,
        description: installmentDesc,
        amount: currentAmount,
        category: category || 'Outros',
        dateStr: dueDateStr,
        year: dueYear,
        month: dueMonth,
        paymentMethod: paymentMethod || 'Cartão de Crédito',
        installmentNumber: 1,
        totalInstallments: count
      };

      await db.execute({
        sql: 'UPDATE expenses SET parent_expense_id = ? WHERE id = ?',
        args: [insertedId, insertedId]
      });
    }
  }

  return firstExpense;
}

async function updateExpense(id, description, amount, category, dateStr, paymentMethod) {
  const db = getDatabase();
  const dateObj = new Date(dateStr + 'T12:00:00');
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;

  await db.execute({
    sql: `UPDATE expenses 
          SET description = ?, amount = ?, category = ?, date_str = ?, year = ?, month = ?, payment_method = ?
          WHERE id = ?`,
    args: [description, amount, category, dateStr, year, month, paymentMethod, id]
  });

  return { id, description, amount, category, dateStr, year, month, paymentMethod };
}

async function deleteExpense(id) {
  const db = getDatabase();
  await db.execute({ sql: 'DELETE FROM expenses WHERE id = ?', args: [id] });
}

async function getExpensesByMonth(year, month) {
  const db = getDatabase();
  const resItems = await db.execute({
    sql: 'SELECT * FROM expenses WHERE year = ? AND month = ? ORDER BY date_str DESC, id DESC',
    args: [year, month]
  });

  const resTotal = await db.execute({
    sql: 'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE year = ? AND month = ?',
    args: [year, month]
  });

  return {
    items: resItems.rows,
    total: resTotal.rows[0] ? Number(resTotal.rows[0].total) : 0
  };
}

async function getAllExpenses(year = null, month = null) {
  const db = getDatabase();
  let query = 'SELECT * FROM expenses';
  const params = [];
  if (year && month) {
    query += ' WHERE year = ? AND month = ?';
    params.push(year, month);
  }
  query += ' ORDER BY date_str DESC, id DESC';
  const res = await db.execute({ sql: query, args: params });
  return res.rows;
}

// --- Devedores & Parcelas ---
async function addDebtor(name, phone, notes) {
  const db = getDatabase();
  const res = await db.execute({
    sql: 'INSERT INTO debtors (name, phone, notes) VALUES (?, ?, ?)',
    args: [name, phone || '', notes || '']
  });
  return { id: Number(res.lastInsertRowid), name, phone, notes };
}

async function updateDebtor(id, name, phone, notes) {
  const db = getDatabase();
  await db.execute({
    sql: 'UPDATE debtors SET name = ?, phone = ?, notes = ? WHERE id = ?',
    args: [name, phone || '', notes || '', id]
  });
}

async function deleteDebtor(id) {
  const db = getDatabase();
  await db.execute({ sql: 'DELETE FROM debt_installments WHERE debtor_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM debt_items WHERE debtor_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM debtors WHERE id = ?', args: [id] });
}

async function getDebtorById(id) {
  const db = getDatabase();
  const res = await db.execute({ sql: 'SELECT * FROM debtors WHERE id = ?', args: [id] });
  return res.rows[0] || null;
}

async function addDebtItem(debtorId, description, totalAmount, installmentsCount, startDateStr) {
  const db = getDatabase();
  const checkDebtor = await db.execute({ sql: 'SELECT id FROM debtors WHERE id = ?', args: [debtorId] });
  if (checkDebtor.rows.length === 0) {
    throw new Error(`Pessoa com ID ${debtorId} não existe ou foi excluída.`);
  }

  const count = parseInt(installmentsCount, 10) || 1;
  const itemResult = await db.execute({
    sql: 'INSERT INTO debt_items (debtor_id, description, total_amount, installments_count, start_date) VALUES (?, ?, ?, ?, ?)',
    args: [debtorId, description, totalAmount, count, startDateStr]
  });

  const debtItemId = Number(itemResult.lastInsertRowid);
  const installmentAmount = Math.round((totalAmount / count) * 100) / 100;
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

    await db.execute({
      sql: `INSERT INTO debt_installments (
              debt_item_id, debtor_id, installment_number, total_installments, 
              amount, due_date, due_year, due_month, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      args: [debtItemId, debtorId, i, count, amount, dueDateStr, dueYear, dueMonth]
    });
  }

  return { debtItemId, debtorId, description, totalAmount, count };
}

async function deleteDebtItem(debtItemId) {
  const db = getDatabase();
  await db.execute({ sql: 'DELETE FROM debt_installments WHERE debt_item_id = ?', args: [debtItemId] });
  await db.execute({ sql: 'DELETE FROM debt_items WHERE id = ?', args: [debtItemId] });
}

async function setInstallmentStatus(installmentId, isPaid) {
  const db = getDatabase();
  const status = isPaid ? 'PAID' : 'PENDING';
  const paidAt = isPaid ? new Date().toISOString() : null;
  await db.execute({
    sql: 'UPDATE debt_installments SET status = ?, paid_at = ? WHERE id = ?',
    args: [status, paidAt, installmentId]
  });
}

async function payAllDebtorInstallments(debtorId) {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.execute({
    sql: "UPDATE debt_installments SET status = 'PAID', paid_at = ? WHERE debtor_id = ? AND status = 'PENDING'",
    args: [now, debtorId]
  });
}

async function getAllDebtorsSummary() {
  const db = getDatabase();
  const debtorsRes = await db.execute('SELECT * FROM debtors ORDER BY name ASC');
  const debtors = debtorsRes.rows;

  const result = [];
  for (const debtor of debtors) {
    const itemsRes = await db.execute({
      sql: 'SELECT * FROM debt_items WHERE debtor_id = ? ORDER BY id DESC',
      args: [debtor.id]
    });
    const items = itemsRes.rows;

    let totalDebt = 0;
    let totalPaid = 0;
    let totalPending = 0;

    for (const item of items) {
      const installmentsRes = await db.execute({
        sql: 'SELECT * FROM debt_installments WHERE debt_item_id = ? ORDER BY installment_number ASC',
        args: [item.id]
      });
      item.installments = installmentsRes.rows;

      for (const inst of item.installments) {
        totalDebt += Number(inst.amount);
        if (inst.status === 'PAID') {
          totalPaid += Number(inst.amount);
        } else {
          totalPending += Number(inst.amount);
        }
      }
    }

    result.push({
      ...debtor,
      total_debt: Math.round(totalDebt * 100) / 100,
      total_paid: Math.round(totalPaid * 100) / 100,
      total_pending: Math.round(totalPending * 100) / 100,
      items
    });
  }

  return result;
}

// --- Preenchimento Automático do Mês ---
async function getReceivablesForMonth(year, month) {
  const db = getDatabase();
  const res = await db.execute({
    sql: `SELECT 
            di.id as installment_id,
            di.amount,
            di.installment_number,
            di.total_installments,
            di.due_date,
            di.status,
            d.id as debtor_id,
            d.name as debtor_name,
            d.phone as debtor_phone,
            item.description as item_description
          FROM debt_installments di
          JOIN debtors d ON di.debtor_id = d.id
          JOIN debt_items item ON di.debt_item_id = item.id
          WHERE di.due_year = ? AND di.due_month = ?
          ORDER BY di.due_date ASC`,
    args: [year, month]
  });

  return res.rows;
}

// --- Relatórios e Estatísticas ---
async function getReceivablesMonthlyStats() {
  const db = getDatabase();
  const res = await db.execute(`
    SELECT due_year as year, due_month as month,
      SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END) as total_received,
      SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END) as total_pending
    FROM debt_installments
    GROUP BY due_year, due_month
    ORDER BY due_year DESC, due_month DESC
    LIMIT 6
  `);
  return res.rows;
}

async function getExpensesMonthlyStats() {
  const db = getDatabase();
  const res = await db.execute(`
    SELECT year, month, SUM(amount) as total
    FROM expenses
    GROUP BY year, month
    ORDER BY year DESC, month DESC
    LIMIT 6
  `);
  return res.rows;
}

async function getExpensesByCategory(year, month) {
  const db = getDatabase();
  const res = await db.execute({
    sql: `SELECT category, SUM(amount) as total, COUNT(*) as count
          FROM expenses
          WHERE year = ? AND month = ?
          GROUP BY category
          ORDER BY total DESC`,
    args: [year, month]
  });
  return res.rows;
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
  getDebtorById,
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
