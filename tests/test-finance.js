const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

// Usa um banco de teste temporário
const testDbPath = path.join(__dirname, 'test_finance.db');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

// Configura DB_PATH para teste
process.env.DB_PATH = testDbPath;
const config = require('../src/config');
config.DB_PATH = testDbPath;

const parser = require('../src/services/messageParser');
const repo = require('../src/database/repository');
const financeService = require('../src/services/financeService');
const conversationManager = require('../src/services/conversationManager');

async function runTests() {
  console.log('🧪 Iniciando Testes Automatizados do APP Financeiro Saulo...\n');

  // 1. Testes do MessageParser
  console.log('1️⃣ Testando Parser de Mensagens...');
  const t1 = parser.parse('Mercado 85,50');
  assert.strictEqual(t1.type, 'EXPENSE');
  assert.strictEqual(t1.amount, 85.50);
  assert.strictEqual(t1.category, 'Mercado');

  const t2 = parser.parse('Almoço 35');
  assert.strictEqual(t2.type, 'EXPENSE');
  assert.strictEqual(t2.amount, 35);
  assert.strictEqual(t2.category, 'Alimentação');

  const t3 = parser.parse('Gasolina 120 posto shell');
  assert.strictEqual(t3.type, 'EXPENSE');
  assert.strictEqual(t3.amount, 120);
  assert.strictEqual(t3.category, 'Transporte');

  const t4 = parser.parse('R$ 45,90 Farmácia');
  assert.strictEqual(t4.type, 'EXPENSE');
  assert.strictEqual(t4.amount, 45.90);
  assert.strictEqual(t4.category, 'Saúde');

  const t5 = parser.parse('saldo');
  assert.strictEqual(t5.type, 'COMMAND');
  assert.strictEqual(t5.command, 'BALANCE');

  const t6 = parser.parse('apagar 42');
  assert.strictEqual(t6.type, 'COMMAND');
  assert.strictEqual(t6.command, 'DELETE_EXPENSE');
  assert.strictEqual(t6.id, 42);

  console.log('   ✅ Parser aprovado em todos os formatos!\n');

  // 2. Testando Fluxo de Conversação (Onboarding)
  console.log('2️⃣ Testando Fluxo de Boas-Vindas e Onboarding...');
  const chatId = 'test_saulo_chat';

  // Mensagem inicial qualquer dispara boas-vindas e pede despesas fixas
  const resp1 = await conversationManager.handleMessage(chatId, 'Oi');
  assert(resp1.includes('PASSO 1 DE 2 — Despesas Fixas'));

  // Cadastra despesa fixa: Aluguel 1500
  const resp2 = await conversationManager.handleMessage(chatId, 'Aluguel 1500');
  assert(resp2.includes('Adicionada(s) com sucesso'));
  assert(resp2.includes('Aluguel'));

  // Cadastra outra despesa fixa: Internet 100
  const resp3 = await conversationManager.handleMessage(chatId, 'Internet 100');
  assert(resp3.includes('Internet'));

  // Finaliza despesas fixas
  const resp4 = await conversationManager.handleMessage(chatId, 'pronto');
  assert(resp4.includes('Passo 1 Concluído'));
  assert(resp4.includes('PASSO 2 DE 2 — Renda do Mês'));

  // Informa renda: 5000
  const resp5 = await conversationManager.handleMessage(chatId, '5000');
  assert(resp5.includes('CONFIGURAÇÃO DO MÊS CONCLUÍDA'));
  assert(resp5.includes('5.000,00')); // Renda
  assert(resp5.includes('1.600,00')); // Fixas
  assert(resp5.includes('3.400,00')); // Sobra Inicial

  console.log('   ✅ Onboarding e cálculo de sobra inicial validados com sucesso!\n');

  // 3. Testando Lançamentos e Subtração da Sobra
  console.log('3️⃣ Testando Lançamentos de Gastos e Abatimento do Saldo...');
  // Gasto 1: Mercado 80,00
  const expResp1 = await conversationManager.handleMessage(chatId, 'Mercado 80');
  assert(expResp1.includes('Registrado Mercado'));
  assert(expResp1.includes('3.320,00')); // 3400 - 80 = 3320

  // Gasto 2: Almoço 30,00 (Total do dia: 80 + 30 = 110 -> Deve disparar alerta diário de R$ 100!)
  const expResp2 = await conversationManager.handleMessage(chatId, 'Almoço 30');
  assert(expResp2.includes('3.290,00')); // 3320 - 30 = 3290
  assert(expResp2.includes('ALERTA DE GASTO DIÁRIO'));
  assert(expResp2.includes('110,00')); // Total do dia

  console.log('   ✅ Gasto registrado, saldo subtraído e Alerta Diário (> R$ 100) disparado corretamente!\n');

  // 4. Testando Alerta de Saldo Crítico (<= R$ 200)
  console.log('4️⃣ Testando Alerta de Saldo Restante Crítico (<= R$ 200)...');
  // Lança um gasto grande que deixe a sobra em R$ 190 (3290 - 3100 = 190)
  const expResp3 = await conversationManager.handleMessage(chatId, 'Conserto 3100');
  assert(expResp3.includes('190,00'));
  assert(expResp3.includes('ALERTA DE SALDO CRÍTICO'));

  console.log('   ✅ Alerta de Saldo Crítico (<= R$ 200) disparado pontualmente!\n');

  // 5. Testando Relatórios
  console.log('5️⃣ Testando Geração de Relatórios...');
  const repSemanal = await conversationManager.handleMessage(chatId, 'semanal');
  assert(repSemanal.includes('RELATÓRIO SEMANAL'));
  assert(repSemanal.includes('Total Gasto na Semana'));

  const repQuinzenal = await conversationManager.handleMessage(chatId, 'quinzenal');
  assert(repQuinzenal.includes('RELATÓRIO QUINZENAL'));

  const repMensal = await conversationManager.handleMessage(chatId, 'mensal');
  assert(repMensal.includes('RELATÓRIO MENSAL COMPLETO'));
  assert(repMensal.includes('Total Despesas Fixas'));
  assert(repMensal.includes('Divisão por Categorias'));

  const repSaldo = await conversationManager.handleMessage(chatId, 'saldo');
  assert(repSaldo.includes('APP FINANCEIRO SAULO — RESUMO ATUAL'));

  console.log('   ✅ Todos os relatórios gerados com sucesso!\n');

  // Limpeza
  const { closeDatabase } = require('../src/database/db');
  closeDatabase();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO! 100% OPERACIONAL.');
}

runTests().catch(err => {
  console.error('❌ Falha nos testes:', err);
  process.exit(1);
});
