const cron = require('node-cron');
const config = require('../config');
const financeService = require('../services/financeService');

let whatsappClient = null;
let targetChatJid = null;

function setWhatsAppClient(client) {
  whatsappClient = client;
}

function setTargetChatJid(jid) {
  targetChatJid = jid;
}

async function sendScheduledMessage(text) {
  if (!whatsappClient || !targetChatJid) {
    console.log('[CRON] WhatsApp não conectado ou chat de destino ainda não identificado.');
    return;
  }
  try {
    await whatsappClient.sendMessage(targetChatJid, { text });
    console.log('[CRON] Relatório agendado enviado com sucesso para:', targetChatJid);
  } catch (err) {
    console.error('[CRON] Erro ao enviar mensagem agendada:', err.message);
  }
}

function initCronJobs() {
  console.log('⏰ Inicializando agendador de relatórios automáticos (Cron)...');

  // 1. Relatório Semanal: Todo Domingo às 20h
  cron.schedule(config.CRON_WEEKLY, async () => {
    console.log('[CRON] Executando disparo do Relatório Semanal...');
    const report = financeService.getWeeklyReport();
    await sendScheduledMessage(`📢 *RELATÓRIO AUTOMÁTICO SEMANAL*\n\n${report}`);
  });

  // 2. Relatório Quinzenal: Todo dia 15 às 20h
  cron.schedule(config.CRON_QUINZENAL, async () => {
    console.log('[CRON] Executando disparo do Relatório Quinzenal...');
    const report = financeService.getQuinzenalReport();
    await sendScheduledMessage(`📢 *RELATÓRIO AUTOMÁTICO QUINZENAL*\n\n${report}`);
  });

  // 3. Relatório Mensal: Último dia do mês às 20h
  cron.schedule(config.CRON_MONTHLY, async () => {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    // Dispara apenas se amanhã for dia 1 (ou seja, hoje é o último dia do mês)
    if (tomorrow.getDate() === 1) {
      console.log('[CRON] Executando disparo do Relatório Mensal no último dia do mês...');
      const report = financeService.getMonthlyReport();
      await sendScheduledMessage(`📢 *RELATÓRIO AUTOMÁTICO DE FECHAMENTO MENSAL*\n\n${report}`);
    }
  });

  console.log('✅ Agendador configurado: Semanal (Domingos 20h), Quinzenal (Dia 15 20h), Mensal (Último dia 20h).');
}

module.exports = {
  initCronJobs,
  setWhatsAppClient,
  setTargetChatJid
};
