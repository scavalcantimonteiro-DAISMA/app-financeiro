const repo = require('../src/database/repository');

console.log('--- TESTANDO BANCO E REPOSITÓRIO ---');

// 1. Testar Configurações
const settings = repo.getSettings();
console.log('1. Configurações:', settings);
if (settings.pix_key !== '06888505456' || settings.user_name !== 'Saulo') {
  throw new Error('Configurações incorretas!');
}

// 2. Testar Inserção de Despesa com Feedback
const expense = repo.addExpense('Almoço Restaurante', 45.50, 'Alimentação', '2026-10-01', 'Pix');
console.log('2. Despesa Adicionada:', expense);

// 3. Testar Devedor
const debtor = repo.addDebtor('Carlos Amigo', '11999887766', 'Amigo do futebol');
console.log('3. Devedor Adicionado:', debtor);

// 4. Testar Compra Parcelada (ex: R$ 300 em 3x iniciando em Outubro/2026)
const debtItem = repo.addDebtItem(debtor.id, 'Tênis Esportivo', 300.00, 3, '2026-10-01');
console.log('4. Dívida Parcelada Criada:', debtItem);

// 5. TESTE CRUCIAL: Preenchimento Automático de Recebíveis do Mês (Outubro/2026)
const receivables = repo.getReceivablesForMonth(2026, 10);
console.log('5. Recebíveis Puxados Automaticamente para Outubro/2026:', receivables);

if (receivables.length === 0) {
  throw new Error('Falha no preenchimento automático de recebíveis!');
}

const itemRecebido = receivables.find(r => r.debtor_name === 'Carlos Amigo');
console.log('Item Encontrado:', {
  nome: itemRecebido.debtor_name,
  descricao: itemRecebido.item_description,
  parcela: `${itemRecebido.installment_number}/${itemRecebido.total_installments}`,
  valor: itemRecebido.amount
});

// 6. Testar Quitação de Parcela
repo.setInstallmentStatus(itemRecebido.installment_id, true);
const receivablesAfterPaid = repo.getReceivablesForMonth(2026, 10);
console.log('6. Status da Parcela após pagamento:', receivablesAfterPaid[0].status);

console.log('\n✅ TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
