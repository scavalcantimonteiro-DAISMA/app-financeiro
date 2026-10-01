const repo = require('../database/repository');
const financeService = require('./financeService');
const { formatMoney, getTodayInfo } = require('./financeService');
const parser = require('./messageParser');

class ConversationManager {
  async handleMessage(chatId, text) {
    if (!text || typeof text !== 'string') return null;

    const trimmed = text.trim();
    const { year, month } = getTodayInfo();
    const budget = repo.getBudget(year, month);
    const currentState = repo.getConversationState(chatId);

    // Se o usuário pedir para reconfigurar em qualquer momento
    const parsedCommand = parser.parse(trimmed);
    if (parsedCommand.type === 'COMMAND' && parsedCommand.command === 'CONFIG') {
      repo.setConversationState(chatId, 'AWAITING_FIXED_EXPENSES', { year, month, fixedCount: 0 });
      return this.getStartConfigMessage();
    }

    // Se o mês ainda não foi configurado e estamos IDLE, inicia o onboarding automaticamente
    if ((!budget || !budget.is_configured) && currentState.state === 'IDLE') {
      repo.setConversationState(chatId, 'AWAITING_FIXED_EXPENSES', { year, month, fixedCount: 0 });
      return this.getWelcomeAndStartConfigMessage();
    }

    // 1. Estado: AWAITING_FIXED_EXPENSES
    if (currentState.state === 'AWAITING_FIXED_EXPENSES') {
      return this.handleAwaitingFixedExpenses(chatId, trimmed, currentState.tempData || { year, month, fixedCount: 0 });
    }

    // 2. Estado: AWAITING_INCOME
    if (currentState.state === 'AWAITING_INCOME') {
      return this.handleAwaitingIncome(chatId, trimmed, currentState.tempData || { year, month });
    }

    // 3. Estado: IDLE (Modo Normal de Gastos e Comandos)
    return this.handleIdleMessage(chatId, trimmed);
  }

  getWelcomeAndStartConfigMessage() {
    return (
      `👋 *Olá, Saulo! Seja bem-vindo ao APP Financeiro Saulo!* 💰✨\n\n` +
      `Vamos organizar o seu mês para você nunca mais perder o controle do seu dinheiro.\n\n` +
      `*PASSO 1 DE 2 — Despesas Fixas:*\n` +
      `Quais são suas contas fixas deste mês? (Ex: Aluguel, Internet, Luz, Água, Academia, etc.)\n\n` +
      `👉 Envie uma despesa por mensagem no formato: *Nome Valor*\n` +
      `_Exemplo:_\n` +
      `• Aluguel 1500\n` +
      `• Internet 120\n` +
      `• Luz 180\n\n` +
      `*(Quando terminar de enviar todas as contas fixas, digite **pronto** ou **nenhuma** se não tiver).*`
    );
  }

  getStartConfigMessage() {
    return (
      `⚙️ *CONFIGURAÇÃO DO MÊS — APP FINANCEIRO SAULO*\n\n` +
      `Vamos redefinir suas despesas fixas e sua renda.\n\n` +
      `*PASSO 1: Despesas Fixas*\n` +
      `Envie cada despesa fixa no formato *Nome Valor* (ex: *Aluguel 1500*).\n` +
      `Quando terminar todas, digite *pronto*.`
    );
  }

  handleAwaitingFixedExpenses(chatId, text, tempData) {
    const lower = text.toLowerCase();
    const { year, month } = tempData;

    // Conclusão do passo de despesas fixas
    if (lower === 'pronto' || lower === 'fim' || lower === 'ok' || lower === 'nenhuma' || lower === 'acabou') {
      repo.setConversationState(chatId, 'AWAITING_INCOME', { year, month });
      const totalFixed = repo.getTotalFixedExpenses(year, month);
      const list = repo.getFixedExpenses(year, month);

      let msg = `✅ *Passo 1 Concluído!*\n\n`;
      if (list.length > 0) {
        msg += `🔒 *Total de Despesas Fixas Cadastradas:* ${formatMoney(totalFixed)}\n`;
        for (const f of list) {
          msg += `   • ${f.name}: ${formatMoney(f.amount)}\n`;
        }
      } else {
        msg += `🔒 Nenhuma despesa fixa registrada.\n`;
      }

      msg += `\n*PASSO 2 DE 2 — Renda do Mês:*\n`;
      msg += `💵 Agora, por favor, me informe: *qual foi a renda que entrou neste mês?*\n`;
      msg += `(Envie apenas o valor, por exemplo: *5000* ou *5.500,00*)`;
      return msg;
    }

    // Processar uma ou várias linhas de despesas fixas
    const lines = text.split('\n');
    let addedCount = 0;
    const addedList = [];

    for (const line of lines) {
      const parsed = parser.parseFixedExpenseLine(line);
      if (parsed) {
        repo.addFixedExpense(year, month, parsed.name, parsed.amount);
        addedList.push(`${parsed.name}: ${formatMoney(parsed.amount)}`);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      tempData.fixedCount = (tempData.fixedCount || 0) + addedCount;
      repo.setConversationState(chatId, 'AWAITING_FIXED_EXPENSES', tempData);

      let response = `➕ *Adicionada(s) com sucesso:*\n`;
      for (const item of addedList) {
        response += `✔️ ${item}\n`;
      }
      response += `\nEnvie outra despesa fixa ou digite *pronto* para ir para a renda.`;
      return response;
    }

    return (
      `⚠️ Não consegui entender o formato da despesa fixa.\n` +
      `Envie no formato *Nome Valor* (ex: *Aluguel 1500* ou *Internet 99,90*).\n` +
      `Se já terminou, envie apenas *pronto*.`
    );
  }

  handleAwaitingIncome(chatId, text, tempData) {
    const { year, month } = tempData;
    const parsed = parser.parse(text);
    let amount = null;

    if (parsed.type === 'EXPENSE') {
      amount = parsed.amount;
    } else {
      const match = text.match(/^(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)$/i);
      if (match) {
        let cleaned = match[1].replace(/\./g, '').replace(',', '.');
        amount = parseFloat(cleaned);
      }
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return (
        `⚠️ Por favor, informe um valor de renda válido.\n` +
        `Exemplo: *5000* ou *4850,50*`
      );
    }

    // Salva a renda e finaliza onboarding
    repo.upsertBudget(year, month, amount, 1);
    repo.setConversationState(chatId, 'IDLE');

    const balance = financeService.getBalanceInfo(year, month);

    let msg = `🎉 *CONFIGURAÇÃO DO MÊS CONCLUÍDA!* 🎉\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💵 *Renda Total do Mês:* ${formatMoney(balance.income)}\n`;
    msg += `🔒 *Total Despesas Fixas:* ${formatMoney(balance.totalFixed)}\n`;
    msg += `🎯 *SOBRA INICIAL DISPONÍVEL:* *${formatMoney(balance.initialSobra)}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🚀 *Como usar no dia a dia:*\n`;
    msg += `Cada vez que gastar algo, basta me mandar aqui:\n`;
    msg += `👉 *Mercado 85,50*\n`;
    msg += `👉 *Almoço 35*\n`;
    msg += `👉 *Gasolina 120*\n\n`;
    msg += `O valor será automaticamente subtraído da sua sobra restante!\n`;
    msg += `Digite *ajuda* a qualquer momento para ver relatórios e alertas.`;
    return msg;
  }

  handleIdleMessage(chatId, text) {
    const parsed = parser.parse(text);

    // 1. Tratamento de Comandos
    if (parsed.type === 'COMMAND') {
      switch (parsed.command) {
        case 'HELP':
          return this.getHelpMessage();
        case 'BALANCE':
          return financeService.getStatusMessage();
        case 'REPORT_WEEKLY':
          return financeService.getWeeklyReport();
        case 'REPORT_QUINZENAL':
          return financeService.getQuinzenalReport();
        case 'REPORT_MONTHLY':
          return financeService.getMonthlyReport();
        case 'EXTRATO':
          return financeService.getRecentTransactionsMessage();
        case 'FIXED_LIST':
          return this.getFixedExpensesMessage();
        case 'DELETE_EXPENSE': {
          const deleted = repo.deleteExpense(parsed.id);
          if (deleted) {
            const balance = financeService.getBalanceInfo();
            return `🗑️ *Gasto #${deleted.id} apagado com sucesso!*\nItem: ${deleted.category} - ${formatMoney(deleted.amount)}\n💰 *Novo Saldo Restante:* ${formatMoney(balance.remainingSobra)}`;
          }
          return `❌ Não encontrei nenhum gasto com o ID #${parsed.id}. Digite *extrato* para conferir os IDs.`;
        }
      }
    }

    // 2. Registro de Gasto
    if (parsed.type === 'EXPENSE') {
      const result = financeService.recordExpense(parsed.category, parsed.amount, parsed.description);

      const itemNome = result.description ? (result.description.charAt(0).toUpperCase() + result.description.slice(1)) : result.category;

      let msg = `✅ *Registrado ${itemNome} ${formatMoney(result.amount)}*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🏷️ *Categoria:* ${result.category}\n`;
      msg += `💰 *Saldo Restante no Mês:* *${formatMoney(result.balance.remainingSobra)}*\n`;
      msg += `📅 *Total Gasto Hoje:* ${formatMoney(result.dailyTotal)}\n`;

      // Inclui alertas se disparados
      if (result.alerts && result.alerts.length > 0) {
        for (const alert of result.alerts) {
          msg += `\n${alert.message}\n`;
        }
      }

      return msg;
    }

    // 3. Mensagem não reconhecida
    return (
      `🤔 Não entendi o que deseja registrar.\n\n` +
      `💡 *Para lançar um gasto, basta digitar:*\n` +
      `👉 *Mercado 85,50*\n` +
      `👉 *Almoço 35*\n` +
      `👉 *Gasolina 120*\n\n` +
      `Ou digite *saldo*, *semanal*, *quinzenal*, *mensal* ou *ajuda*.`
    );
  }

  getFixedExpensesMessage() {
    const { year, month } = getTodayInfo();
    const list = repo.getFixedExpenses(year, month);
    const total = repo.getTotalFixedExpenses(year, month);

    if (list.length === 0) {
      return `🔒 Nenhuma despesa fixa cadastrada este mês. Digite *configurar* para cadastrar.`;
    }

    let msg = `🔒 *DESPESAS FIXAS DO MÊS (${String(month).padStart(2, '0')}/${year})*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    for (const f of list) {
      msg += `• *${f.name}:* ${formatMoney(f.amount)}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💵 *Total Fixo:* ${formatMoney(total)}\n`;
    return msg;
  }

  getHelpMessage() {
    return (
      `🤖 *APP FINANCEIRO SAULO — GUIA DE COMANDOS*\n\n` +
      `💸 *Registrar Gastos:*\n` +
      `Envie direto o que gastou e o valor:\n` +
      `• _Almoço 35_\n` +
      `• _Mercado 85,50_\n` +
      `• _Gasolina 120_\n` +
      `• _Farmácia 45.90_\n\n` +
      `📊 *Relatórios & Consultas:*\n` +
      `• *saldo* → Ver renda, total fixo, gastos e sobra restante\n` +
      `• *semanal* → Relatório completo dos últimos 7 dias\n` +
      `• *quinzenal* → Relatório da quinzena atual\n` +
      `• *mensal* → Relatório detalhado do mês todo\n` +
      `• *extrato* → Lista dos últimos lançamentos\n` +
      `• *fixas* → Lista das contas fixas cadastradas\n` +
      `• *apagar [id]* → Apaga um gasto lançado por engano\n` +
      `• *configurar* → Redefine despesas fixas e renda do mês\n\n` +
      `🚨 *Alertas Automáticos Ativos:*\n` +
      `• Alerta ao atingir mais de R$ 100,00 em um único dia\n` +
      `• Alerta quando restar apenas R$ 200,00 da sua sobra do mês`
    );
  }
}

module.exports = new ConversationManager();
