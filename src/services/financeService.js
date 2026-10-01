const repo = require('../database/repository');
const config = require('../config');

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function getTodayInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = String(now.getDate()).padStart(2, '0');
  const monthStr = String(month).padStart(2, '0');
  const dateStr = `${year}-${monthStr}-${day}`;
  return { now, year, month, day: now.getDate(), dateStr };
}

class FinanceService {
  getBalanceInfo(targetYear, targetMonth) {
    const { year, month } = targetYear && targetMonth ? { year: targetYear, month: targetMonth } : getTodayInfo();
    const budget = repo.getBudget(year, month);
    const income = budget ? Number(budget.income) : 0;
    const isConfigured = budget ? Boolean(budget.is_configured) : false;

    const fixedExpenses = repo.getFixedExpenses(year, month);
    const totalFixed = repo.getTotalFixedExpenses(year, month);
    
    const initialSobra = Math.max(0, income - totalFixed);
    const totalExpenses = repo.getTotalExpensesByMonth(year, month);
    const remainingSobra = income - totalFixed - totalExpenses;
    
    return {
      year,
      month,
      income,
      isConfigured,
      fixedExpenses,
      totalFixed,
      initialSobra,
      totalExpenses,
      remainingSobra
    };
  }

  recordExpense(category, amount, description = '') {
    const { year, month, dateStr } = getTodayInfo();
    const expenseId = repo.addExpense(category, description, amount, dateStr, year, month);
    const balance = this.getBalanceInfo(year, month);
    
    // Verificação de Alertas
    const alerts = [];

    // Alerta 1: Limite Diário (Gastos acumulados no dia ultrapassam R$ 100)
    const dailyTotal = repo.getDailyExpenseSum(dateStr);
    if (dailyTotal > config.ALERT_DAILY_LIMIT) {
      const alertKey = `daily_${dateStr}`;
      // Verifica se já enviamos o alerta diário hoje para não ficar floodando a cada centavo
      if (!repo.hasAlertBeenSent('DAILY_LIMIT', alertKey)) {
        alerts.push({
          type: 'DAILY_LIMIT',
          message: `🚨 *ALERTA DE GASTO DIÁRIO!* 🚨\nVocê atingiu *${formatMoney(dailyTotal)}* em gastos hoje, superando o teto diário de *${formatMoney(config.ALERT_DAILY_LIMIT)}*!\nSegure as pontas para não estourar o mês.`
        });
        repo.recordAlert('DAILY_LIMIT', alertKey);
      }
    }

    // Alerta 2: Saldo Restante Crítico (<= R$ 200)
    if (balance.remainingSobra <= config.ALERT_LOW_BALANCE) {
      const alertKey = `low_balance_${year}_${month}`;
      if (!repo.hasAlertBeenSent('LOW_BALANCE', alertKey)) {
        alerts.push({
          type: 'LOW_BALANCE',
          message: `⚠️ *ALERTA DE SALDO CRÍTICO!* ⚠️\nAtenção, Saulo! Seu saldo restante para o mês é de apenas *${formatMoney(balance.remainingSobra)}*!\nVocê atingiu a marca de segurança de *${formatMoney(config.ALERT_LOW_BALANCE)}*. Priorize apenas o essencial!`
        });
        repo.recordAlert('LOW_BALANCE', alertKey);
      }
    }

    return {
      expenseId,
      category,
      amount,
      description,
      dateStr,
      balance,
      dailyTotal,
      alerts
    };
  }

  // Relatório Rápido / Saldo Atual
  getStatusMessage() {
    const balance = this.getBalanceInfo();
    const { dateStr } = getTodayInfo();
    const dailyTotal = repo.getDailyExpenseSum(dateStr);

    let msg = `📊 *APP FINANCEIRO SAULO — RESUMO ATUAL*\n`;
    msg += `📅 Mês: ${String(balance.month).padStart(2, '0')}/${balance.year}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💵 *Renda Total:* ${formatMoney(balance.income)}\n`;
    msg += `🔒 *Despesas Fixas:* ${formatMoney(balance.totalFixed)}\n`;
    msg += `🎯 *Sobra Inicial:* ${formatMoney(balance.initialSobra)}\n`;
    msg += `💸 *Gastos Variáveis Realizados:* ${formatMoney(balance.totalExpenses)}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;

    if (balance.remainingSobra <= 0) {
      msg += `🚨 *SALDO NEGATIVO:* ${formatMoney(balance.remainingSobra)} (Orçamento estourado!)\n`;
    } else if (balance.remainingSobra <= config.ALERT_LOW_BALANCE) {
      msg += `⚠️ *SALDO RESTANTE:* ${formatMoney(balance.remainingSobra)} (Crítico!)\n`;
    } else {
      msg += `💰 *SALDO RESTANTE:* ${formatMoney(balance.remainingSobra)}\n`;
    }

    msg += `📅 *Gasto Total de Hoje:* ${formatMoney(dailyTotal)} (Limite: ${formatMoney(config.ALERT_DAILY_LIMIT)})\n`;
    return msg;
  }

  // Relatório Semanal (Últimos 7 dias)
  getWeeklyReport() {
    const { now } = getTodayInfo();
    const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    
    const formatDate = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const startStr = formatDate(sevenDaysAgo);
    const endStr = formatDate(now);
    const expenses = repo.getExpensesForPeriod(startStr, endStr);

    const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const mediaDiaria = total / 7;

    // Agrupamento por categoria
    const categoryMap = {};
    for (const exp of expenses) {
      categoryMap[exp.category] = (categoryMap[exp.category] || 0) + exp.amount;
    }

    const categoriesSorted = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

    let msg = `📈 *RELATÓRIO SEMANAL (ÚLTIMOS 7 DIAS)*\n`;
    msg += `🗓 Período: ${startStr.split('-').reverse().join('/')} a ${endStr.split('-').reverse().join('/')}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💸 *Total Gasto na Semana:* ${formatMoney(total)}\n`;
    msg += `📊 *Média Diária:* ${formatMoney(mediaDiaria)}\n`;
    msg += `📝 *Quantidade de Lançamentos:* ${expenses.length}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🏷️ *Gastos por Categoria:*\n`;

    if (categoriesSorted.length === 0) {
      msg += `_Nenhum gasto registrado nesta semana._\n`;
    } else {
      for (const [cat, val] of categoriesSorted) {
        const perc = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
        msg += `• *${cat}:* ${formatMoney(val)} (${perc}%)\n`;
      }
    }

    const balance = this.getBalanceInfo();
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *Saldo Restante no Mês:* ${formatMoney(balance.remainingSobra)}\n`;
    return msg;
  }

  // Relatório Quinzenal
  getQuinzenalReport() {
    const { year, month, day } = getTodayInfo();
    const isPrimeiraQuinzena = day <= 15;
    
    const mStr = String(month).padStart(2, '0');
    let startStr, endStr, quinzenaNome;

    if (isPrimeiraQuinzena) {
      quinzenaNome = `1ª Quinzena (01/${mStr} a 15/${mStr})`;
      startStr = `${year}-${mStr}-01`;
      endStr = `${year}-${mStr}-15`;
    } else {
      const lastDay = new Date(year, month, 0).getDate();
      quinzenaNome = `2ª Quinzena (16/${mStr} a ${lastDay}/${mStr})`;
      startStr = `${year}-${mStr}-16`;
      endStr = `${year}-${mStr}-${lastDay}`;
    }

    const expenses = repo.getExpensesForPeriod(startStr, endStr);
    const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);

    const categoryMap = {};
    for (const exp of expenses) {
      categoryMap[exp.category] = (categoryMap[exp.category] || 0) + exp.amount;
    }
    const categoriesSorted = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

    const balance = this.getBalanceInfo(year, month);
    const metaQuinzena = balance.initialSobra / 2;

    let msg = `🌓 *RELATÓRIO QUINZENAL — ${quinzenaNome}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💸 *Total Gasto nesta Quinzena:* ${formatMoney(total)}\n`;
    msg += `🎯 *Meta estimada da Quinzena (50% sobra):* ${formatMoney(metaQuinzena)}\n`;

    if (total > metaQuinzena && metaQuinzena > 0) {
      msg += `⚠️ _Você gastou ${formatMoney(total - metaQuinzena)} acima do recomendado para a quinzena._\n`;
    } else if (metaQuinzena > 0) {
      msg += `✅ _Você está economizando dentro da meta prevista!_\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🏷️ *Categorias na Quinzena:*\n`;
    if (categoriesSorted.length === 0) {
      msg += `_Nenhum gasto registrado nesta quinzena._\n`;
    } else {
      for (const [cat, val] of categoriesSorted) {
        const perc = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
        msg += `• *${cat}:* ${formatMoney(val)} (${perc}%)\n`;
      }
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *Saldo Restante Atual:* ${formatMoney(balance.remainingSobra)}\n`;
    return msg;
  }

  // Relatório Mensal Completo
  getMonthlyReport(targetYear, targetMonth) {
    const { year, month } = targetYear && targetMonth ? { year: targetYear, month: targetMonth } : getTodayInfo();
    const balance = this.getBalanceInfo(year, month);
    const categories = repo.getExpensesByCategory(year, month);
    const fixedExpenses = repo.getFixedExpenses(year, month);

    const mStr = String(month).padStart(2, '0');
    let msg = `📑 *RELATÓRIO MENSAL COMPLETO — ${mStr}/${year}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💵 *Renda Total do Mês:* ${formatMoney(balance.income)}\n`;
    msg += `🔒 *Total Despesas Fixas:* ${formatMoney(balance.totalFixed)}\n`;
    
    if (fixedExpenses.length > 0) {
      for (const f of fixedExpenses) {
        msg += `   ▫️ ${f.name}: ${formatMoney(f.amount)}\n`;
      }
    }
    
    msg += `🎯 *Sobra Inicial:* ${formatMoney(balance.initialSobra)}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💸 *Total em Gastos Variáveis:* ${formatMoney(balance.totalExpenses)}\n`;
    
    if (categories.length > 0) {
      msg += `\n🏷️ *Divisão por Categorias:*\n`;
      for (const c of categories) {
        const perc = balance.totalExpenses > 0 ? ((c.total / balance.totalExpenses) * 100).toFixed(1) : '0';
        msg += `• *${c.category}* (${c.count}x): ${formatMoney(c.total)} (${perc}%)\n`;
      }
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    if (balance.remainingSobra >= 0) {
      msg += `💰 *SOBRA FINAL DO MÊS:* ${formatMoney(balance.remainingSobra)}\n`;
      msg += `🎉 Parabéns! Você fechou com saldo positivo.\n`;
    } else {
      msg += `🚨 *DÉFICIT FINAL:* ${formatMoney(balance.remainingSobra)}\n`;
      msg += `⚠️ O orçamento foi ultrapassado este mês.\n`;
    }

    return msg;
  }

  // Extrato das Últimas Transações
  getRecentTransactionsMessage(limit = 8) {
    const list = repo.getRecentExpenses(limit);
    if (list.length === 0) {
      return `📭 _Nenhum gasto registrado ainda._`;
    }

    let msg = `📋 *ÚLTIMOS GASTOS REGISTRADOS*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    for (const item of list) {
      const dataBr = item.date_str.split('-').reverse().slice(0, 2).join('/');
      msg += `🆔 *#${item.id}* | ${dataBr} - *${item.category}* (${item.description}): ${formatMoney(item.amount)}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💡 _Para apagar algum lançamento incorreto, envie: *apagar [ID]* (ex: apagar ${list[0].id})_\n`;
    return msg;
  }
}

module.exports = new FinanceService();
module.exports.formatMoney = formatMoney;
module.exports.getTodayInfo = getTodayInfo;
