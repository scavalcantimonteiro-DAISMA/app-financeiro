const express = require('express');
const path = require('node:path');
const config = require('./config');
const repo = require('./database/repository');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Obter ano e mês padrão atual
function getCurrentYearMonth() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1
  };
}

// ==========================================
// 1. CONFIGURAÇÕES & USUÁRIO
// ==========================================
app.get('/api/config', async (req, res) => {
  try {
    const settings = await repo.getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const { user_name, pix_key } = req.body;
    if (user_name) await repo.updateSetting('user_name', user_name);
    if (pix_key) await repo.updateSetting('pix_key', pix_key);
    const updated = await repo.getSettings();
    res.json({ ok: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. DASHBOARD & BALANÇO GERAL DO MÊS
// ==========================================
app.get('/api/dashboard', async (req, res) => {
  try {
    const current = getCurrentYearMonth();
    const year = parseInt(req.query.year, 10) || current.year;
    const month = parseInt(req.query.month, 10) || current.month;

    // 1. Rendas do mês
    const incomes = await repo.getIncomesByMonth(year, month);
    const totalIncome = incomes.reduce((acc, curr) => acc + Number(curr.amount), 0);

    // 2. Contas Fixas do mês com status
    const fixedExpenses = await repo.getFixedExpensesWithStatus(year, month);
    const totalFixed = fixedExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const paidFixed = fixedExpenses
      .filter(f => f.is_paid === 1)
      .reduce((acc, curr) => acc + Number(curr.amount), 0);
    const pendingFixed = totalFixed - paidFixed;

    // 3. Gastos Variáveis do mês
    const expensesData = await repo.getExpensesByMonth(year, month);
    const totalVariableExpenses = expensesData.total;

    // 4. VALORES A RECEBER DE TERCEIROS (PREENCHIMENTO 100% AUTOMÁTICO!)
    const receivables = await repo.getReceivablesForMonth(year, month);
    const totalReceivables = receivables.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const receivedFromDebtors = receivables
      .filter(r => r.status === 'PAID')
      .reduce((acc, curr) => acc + Number(curr.amount), 0);
    const pendingReceivables = totalReceivables - receivedFromDebtors;

    // 5. Cálculos de Balanço e Sobra Real
    const projectedLeftover = (totalIncome + totalReceivables) - (totalFixed + totalVariableExpenses);
    const currentRealBalance = (totalIncome + receivedFromDebtors) - (paidFixed + totalVariableExpenses);

    // Categorias de gastos para mini-resumo
    const categories = await repo.getExpensesByCategory(year, month);

    res.json({
      period: { year, month },
      income: {
        total: totalIncome,
        items: incomes
      },
      fixedExpenses: {
        total: totalFixed,
        paid: paidFixed,
        pending: pendingFixed,
        items: fixedExpenses
      },
      variableExpenses: {
        total: totalVariableExpenses,
        count: expensesData.items.length,
        items: expensesData.items.slice(0, 10)
      },
      receivables: {
        total: totalReceivables,
        received: receivedFromDebtors,
        pending: pendingReceivables,
        items: receivables
      },
      balance: {
        projectedLeftover,
        currentRealBalance
      },
      categories
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. DESPESAS / GASTOS
// ==========================================
app.get('/api/expenses', async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    const month = req.query.month ? parseInt(req.query.month, 10) : null;
    
    if (year && month) {
      const result = await repo.getExpensesByMonth(year, month);
      res.json(result);
    } else {
      const items = await repo.getAllExpenses();
      const total = items.reduce((acc, curr) => acc + Number(curr.amount), 0);
      res.json({ items, total });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const { description, amount, category, dateStr, paymentMethod, installmentsCount } = req.body;
    if (!description || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Descrição e valor válido são obrigatórios.' });
    }

    const count = parseInt(installmentsCount, 10) || 1;
    const todayStr = new Date().toISOString().split('T')[0];
    const finalDate = dateStr || todayStr;
    const finalMethod = paymentMethod || 'Pix';

    const expense = await repo.addExpense(
      description.trim(),
      parseFloat(amount),
      category || 'Outros',
      finalDate,
      finalMethod,
      count
    );

    const message = count > 1
      ? `Compra no crédito em ${count}x contabilizada com sucesso!`
      : `Gasto contabilizado: ${expense.description} - R$ ${expense.amount.toFixed(2)}`;

    res.status(201).json({
      ok: true,
      message,
      expense
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { description, amount, category, dateStr, paymentMethod } = req.body;

    if (!description || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Descrição e valor válido são obrigatórios.' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const finalDate = dateStr || todayStr;
    const finalMethod = paymentMethod || 'Pix';

    const expense = await repo.updateExpense(
      id,
      description.trim(),
      parseFloat(amount),
      category || 'Outros',
      finalDate,
      finalMethod
    );

    res.json({
      ok: true,
      message: `Gasto atualizado: ${expense.description} - R$ ${expense.amount.toFixed(2)}`,
      expense
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await repo.deleteExpense(id);
    res.json({ ok: true, message: 'Gasto excluído com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. QUEM ME DEVE (DEVEDORES & PARCELAS)
// ==========================================
app.get('/api/debtors', async (req, res) => {
  try {
    const debtors = await repo.getAllDebtorsSummary();
    res.json(debtors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/debtors', async (req, res) => {
  try {
    const { name, phone, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome da pessoa é obrigatório.' });
    }
    const debtor = await repo.addDebtor(name.trim(), phone ? phone.trim() : '', notes ? notes.trim() : '');
    res.status(201).json(debtor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/debtors/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, phone, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome da pessoa é obrigatório.' });
    }
    await repo.updateDebtor(id, name.trim(), phone ? phone.trim() : '', notes ? notes.trim() : '');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/debtors/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await repo.deleteDebtor(id);
    res.json({ ok: true, message: 'Devedor excluído com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adicionar uma compra/dívida parcelada para um devedor
app.post('/api/debtors/:id/debts', async (req, res) => {
  try {
    const debtorId = parseInt(req.params.id, 10);
    if (!debtorId || isNaN(debtorId)) {
      return res.status(400).json({ error: 'ID da pessoa inválido ou não informado.' });
    }

    const debtor = await repo.getDebtorById(debtorId);
    if (!debtor) {
      return res.status(404).json({ error: `Pessoa com código ${debtorId} não foi encontrada no sistema.` });
    }

    const { description, totalAmount, installmentsCount, startDate } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'A descrição da dívida é obrigatória.' });
    }

    const amountNum = parseFloat(totalAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'O valor total deve ser um número maior que zero.' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const item = await repo.addDebtItem(
      debtorId,
      description.trim(),
      amountNum,
      parseInt(installmentsCount, 10) || 1,
      startDate || todayStr
    );

    res.status(201).json({ ok: true, item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/debtors/debts/:debtItemId', async (req, res) => {
  try {
    const debtItemId = parseInt(req.params.debtItemId, 10);
    await repo.deleteDebtItem(debtItemId);
    res.json({ ok: true, message: 'Item de dívida excluído com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Marcar parcela como PAGA ou PENDENTE
app.patch('/api/debtors/installments/:installmentId', async (req, res) => {
  try {
    const installmentId = parseInt(req.params.installmentId, 10);
    const { isPaid } = req.body;
    await repo.setInstallmentStatus(installmentId, Boolean(isPaid));
    res.json({ ok: true, status: isPaid ? 'PAID' : 'PENDING' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quitar todas as parcelas pendentes de um devedor
app.post('/api/debtors/:id/pay-all', async (req, res) => {
  try {
    const debtorId = parseInt(req.params.id, 10);
    await repo.payAllDebtorInstallments(debtorId);
    res.json({ ok: true, message: 'Todas as parcelas foram quitadas com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. CONTAS FIXAS & RENDAS
// ==========================================
app.get('/api/fixed-expenses', async (req, res) => {
  try {
    const current = getCurrentYearMonth();
    const year = parseInt(req.query.year, 10) || current.year;
    const month = parseInt(req.query.month, 10) || current.month;
    const list = await repo.getFixedExpensesWithStatus(year, month);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fixed-expenses', async (req, res) => {
  try {
    const { name, amount, dueDay, category } = req.body;
    if (!name || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Nome e valor válido são obrigatórios.' });
    }
    const item = await repo.addFixedExpense(name.trim(), parseFloat(amount), parseInt(dueDay, 10) || 10, category || 'Moradia');
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/fixed-expenses/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, amount, dueDay, category } = req.body;
    await repo.updateFixedExpense(id, name.trim(), parseFloat(amount), parseInt(dueDay, 10) || 10, category || 'Moradia');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/fixed-expenses/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await repo.deleteFixedExpense(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fixed-expenses/:id/toggle-payment', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { year, month, isPaid } = req.body;
    await repo.toggleFixedExpensePayment(id, parseInt(year, 10), parseInt(month, 10), Boolean(isPaid));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rendas
app.get('/api/incomes', async (req, res) => {
  try {
    const current = getCurrentYearMonth();
    const year = parseInt(req.query.year, 10) || current.year;
    const month = parseInt(req.query.month, 10) || current.month;
    const incomes = await repo.getIncomesByMonth(year, month);
    res.json(incomes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/incomes', async (req, res) => {
  try {
    const { year, month, description, amount, receivedDate } = req.body;
    if (!description || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Descrição e valor válido são obrigatórios.' });
    }
    const item = await repo.addIncome(
      parseInt(year, 10),
      parseInt(month, 10),
      description.trim(),
      parseFloat(amount),
      receivedDate
    );
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/incomes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await repo.deleteIncome(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. RELATÓRIOS & GRÁFICOS
// ==========================================
app.get('/api/reports/stats', async (req, res) => {
  try {
    const current = getCurrentYearMonth();
    const year = parseInt(req.query.year, 10) || current.year;
    const month = parseInt(req.query.month, 10) || current.month;

    const expensesByCategory = await repo.getExpensesByCategory(year, month);
    const expensesMonthly = await repo.getExpensesMonthlyStats();
    const debtorsMonthly = await repo.getReceivablesMonthlyStats();
    const debtorsSummary = await repo.getAllDebtorsSummary();

    res.json({
      period: { year, month },
      expensesByCategory,
      expensesMonthly,
      debtorsMonthly,
      debtorsSummary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Iniciar Servidor
const PORT = process.env.PORT || config.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=================================================`);
  console.log(`🚀 APP FINANCEIRO SAULO PRONTO PARA USO!`);
  console.log(`📱 Acesso no Computador: http://localhost:${PORT}`);
  console.log(`🌐 Acesso na Nuvem ou Rede Local: http://0.0.0.0:${PORT}`);
  console.log(`=================================================\n`);
});
