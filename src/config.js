const path = require('node:path');
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  DB_PATH: path.join(__dirname, '..', 'financeiro.db'),
  AUTH_DIR: path.join(__dirname, '..', 'auth_info_baileys'),
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || '',
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN || '',
  
  // Regras de Alertas Financeiros
  ALERT_DAILY_LIMIT: parseFloat(process.env.ALERT_DAILY_LIMIT || '100.00'), // R$ 100 por dia
  ALERT_LOW_BALANCE: parseFloat(process.env.ALERT_LOW_BALANCE || '200.00'), // R$ 200 de saldo restante
  
  // Nome padrão do grupo de finanças pessoal (se usado em grupo)
  TARGET_GROUP_NAME: process.env.TARGET_GROUP_NAME || 'APP Financeiro Saulo',
  
  // Agendamentos Cron
  CRON_WEEKLY: process.env.CRON_WEEKLY || '0 20 * * 0',       // Todo domingo às 20h
  CRON_QUINZENAL: process.env.CRON_QUINZENAL || '0 20 15 * *', // Todo dia 15 às 20h
  CRON_MONTHLY: process.env.CRON_MONTHLY || '0 20 28-31 * *',  // Fim do mês às 20h
};
