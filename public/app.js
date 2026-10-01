// ========================================================
// FINANÇAS SAULO - LÓGICA DO APLICATIVO (PWA / CLIENT-SIDE)
// ========================================================

const state = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  settings: {
    user_name: 'Saulo',
    pix_key: '06888505456'
  },
  dashboard: null,
  expenses: [],
  debtors: [],
  selectedDebtor: null,
  generatedWhatsAppText: '',
  generatedWhatsAppPhone: '',
  charts: {
    categories: null,
    expensesMonthly: null,
    debtorsMonthly: null,
    debtorsRanking: null
  }
};

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Iniciar Aplicação
document.addEventListener('DOMContentLoaded', async () => {
  setupDates();
  registerServiceWorker();
  await loadSettings();
  await loadDashboard();
  await loadExpenses();
  await loadDebtors();
});

// Registrar PWA Service Worker
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('PWA Service Worker Ativo!'))
      .catch((err) => console.log('SW falhou:', err));
  }
}

// Configurar datas e navegadores de mês
function setupDates() {
  updateMonthHeader();
  
  document.getElementById('btn-prev-month').addEventListener('click', () => {
    if (state.month === 1) {
      state.month = 12;
      state.year -= 1;
    } else {
      state.month -= 1;
    }
    onMonthChanged();
  });

  document.getElementById('btn-next-month').addEventListener('click', () => {
    if (state.month === 12) {
      state.month = 1;
      state.year += 1;
    } else {
      state.month += 1;
    }
    onMonthChanged();
  });

  // Preencher campos de data padrão de hoje
  const todayStr = new Date().toISOString().split('T')[0];
  const expenseDateInput = document.getElementById('expense-date');
  if (expenseDateInput) expenseDateInput.value = todayStr;
  const debtItemDateInput = document.getElementById('debt-item-date');
  if (debtItemDateInput) debtItemDateInput.value = todayStr;
}

function updateMonthHeader() {
  const label = `${MONTH_NAMES[state.month - 1]} / ${state.year}`;
  const el = document.getElementById('current-month-label');
  if (el) el.textContent = label;
}

async function onMonthChanged() {
  updateMonthHeader();
  await loadDashboard();
  await loadExpenses();
  if (document.getElementById('screen-charts').classList.contains('active')) {
    await loadCharts();
  }
  if (document.getElementById('screen-settings').classList.contains('active')) {
    await loadSettingsData();
  }
}

// Formatação Monetária
function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

// Converter texto com vírgula ou ponto em número
function parseAmount(val) {
  if (val === null || val === undefined) return 0;
  const str = String(val).replace(/\s/g, '').replace('R$', '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Feedback Sonoro Estilo Apple Pay / Confirmação
function playSuccessSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    // Tom agradável ascendente
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);

    if (navigator.vibrate) {
      navigator.vibrate([30, 20, 30]);
    }
  } catch (e) {
    // Silencioso se não suportado
  }
}

// Feedback Visual Toast
function showFeedbackToast(msg) {
  playSuccessSound();
  const toast = document.getElementById('feedback-toast');
  const toastMsg = document.getElementById('feedback-toast-msg');
  if (toast && toastMsg) {
    toastMsg.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3800);
  }
}

// ========================================================
// CONTROLE DE NAVEGAÇÃO DE ABAS
// ========================================================
function switchTab(tabId) {
  document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.app-screen').forEach(el => el.classList.remove('active'));

  const btn = document.getElementById(tabId);
  if (btn) btn.classList.add('active');

  const screenMap = {
    'tab-dashboard': 'screen-dashboard',
    'tab-expenses': 'screen-expenses',
    'tab-debtors': 'screen-debtors',
    'tab-charts': 'screen-charts',
    'tab-settings': 'screen-settings'
  };

  const targetScreen = document.getElementById(screenMap[tabId]);
  if (targetScreen) targetScreen.classList.add('active');

  if (tabId === 'tab-charts') {
    loadCharts();
  } else if (tabId === 'tab-settings') {
    loadSettingsData();
  } else if (tabId === 'tab-expenses') {
    loadExpenses();
  } else if (tabId === 'tab-debtors') {
    loadDebtors();
  }
}

// ========================================================
// 1. CONFIGURAÇÕES & DADOS DO USUÁRIO
// ========================================================
async function loadSettings() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    state.settings = data;
    
    document.getElementById('header-user-name').textContent = `Olá, ${data.user_name || 'Saulo'}`;
    document.getElementById('header-avatar').textContent = (data.user_name || 'S')[0].toUpperCase();
    document.getElementById('setting-user-name').value = data.user_name || 'Saulo';
    document.getElementById('setting-pix-key').value = data.pix_key || '06888505456';
  } catch (err) {
    console.error('Erro ao carregar configurações:', err);
  }
}

async function saveSettings() {
  const userName = document.getElementById('setting-user-name').value;
  const pixKey = document.getElementById('setting-pix-key').value;

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_name: userName, pix_key: pixKey })
    });
    const data = await res.json();
    if (data.ok) {
      state.settings = data.settings;
      document.getElementById('header-user-name').textContent = `Olá, ${userName}`;
      showFeedbackToast('Configurações salvas com sucesso!');
    }
  } catch (err) {
    alert('Erro ao salvar configurações.');
  }
}

// ========================================================
// 2. DASHBOARD & PREENCHIMENTO AUTOMÁTICO DE RECEBÍVEIS
// ========================================================
async function loadDashboard() {
  try {
    const res = await fetch(`/api/dashboard?year=${state.year}&month=${state.month}`);
    const data = await res.json();
    state.dashboard = data;

    // Atualizar Valores no Topo
    const projectedLeftoverEl = document.getElementById('dash-projected-leftover');
    projectedLeftoverEl.textContent = formatBRL(data.balance.projectedLeftover);
    projectedLeftoverEl.className = 'balance-amount ' + (data.balance.projectedLeftover >= 0 ? 'positive' : 'negative');

    document.getElementById('dash-income').textContent = formatBRL(data.income.total);
    document.getElementById('dash-fixed').textContent = formatBRL(data.fixedExpenses.total);
    document.getElementById('dash-variable').textContent = formatBRL(data.variableExpenses.total);
    document.getElementById('dash-receivables-val').textContent = formatBRL(data.receivables.total);

    // PREENCHIMENTO AUTOMÁTICO DO CARD DE RECEBÍVEIS DE TERCEIROS
    const receivablesTotalEl = document.getElementById('dash-receivables-total');
    const receivablesCountEl = document.getElementById('receivables-count-text');
    const itemsContainer = document.getElementById('receivables-items-container');

    receivablesTotalEl.textContent = formatBRL(data.receivables.total);
    
    if (data.receivables.items && data.receivables.items.length > 0) {
      receivablesCountEl.textContent = `${data.receivables.items.length} parcela(s) a receber neste mês`;
      
      let html = '';
      data.receivables.items.forEach(item => {
        const isPaid = item.status === 'PAID';
        html += `
          <div class="receivable-row">
            <div>
              <strong style="color: #f8fafc;">${item.debtor_name}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                ${item.item_description} (Parcela ${item.installment_number}/${item.total_installments})
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 700; color: ${isPaid ? '#34d399' : '#60a5fa'};">
                ${formatBRL(item.amount)}
              </div>
              <span style="font-size: 0.7rem; color: ${isPaid ? '#34d399' : '#f59e0b'};">
                ${isPaid ? '✅ Recebido' : '⏳ Pendente'}
              </span>
            </div>
          </div>
        `;
      });
      itemsContainer.innerHTML = html;
    } else {
      receivablesCountEl.textContent = 'Nenhuma cobrança com vencimento neste mês';
      itemsContainer.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 8px;">Sem parcelas previstas para este mês.</p>';
    }

    // Renderizar Gastos Recentes no Dashboard
    renderRecentExpenses(data.variableExpenses.items);

  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
  }
}

function toggleReceivablesDetails() {
  const list = document.getElementById('receivables-details-list');
  const arrow = document.getElementById('receivables-arrow');
  if (list) {
    list.classList.toggle('open');
    if (arrow) {
      arrow.className = list.classList.contains('open') ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
    }
  }
}

function renderRecentExpenses(items) {
  const container = document.getElementById('dash-recent-expenses');
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 14px 0;">Nenhum gasto registrado neste mês.</p>';
    return;
  }

  const iconsMap = {
    'Alimentação': '🍔',
    'Transporte': '🚗',
    'Moradia': '🏠',
    'Lazer': '🎉',
    'Saúde': '💊',
    'Supermercado': '🛒',
    'Outros': '📦'
  };

  container.innerHTML = items.slice(0, 5).map(item => `
    <div class="item-card">
      <div class="item-left">
        <div class="item-icon">${iconsMap[item.category] || '💰'}</div>
        <div class="item-info">
          <div class="item-title">${item.description}</div>
          <div class="item-subtitle">${formatDateBR(item.date_str)} • ${item.category} • ${item.payment_method || 'Pix'}</div>
        </div>
      </div>
      <div class="item-right">
        <div class="item-amount" style="color: #f87171;">-${formatBRL(item.amount)}</div>
      </div>
    </div>
  `).join('');
}

// ========================================================
// 3. GASTOS / DESPESAS (CADASTRO, FEEDBACK & EXCEL)
// ========================================================
async function loadExpenses() {
  try {
    const res = await fetch(`/api/expenses?year=${state.year}&month=${state.month}`);
    const data = await res.json();
    state.expenses = data.items || [];

    document.getElementById('expenses-screen-total').textContent = formatBRL(data.total);
    renderFullExpensesList(state.expenses);
  } catch (err) {
    console.error('Erro ao carregar despesas:', err);
  }
}

function renderFullExpensesList(items) {
  const container = document.getElementById('expenses-full-list');
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 30px 0;">Nenhum gasto encontrado para os filtros selecionados.</p>';
    return;
  }

  const iconsMap = {
    'Alimentação': '🍔',
    'Transporte': '🚗',
    'Moradia': '🏠',
    'Lazer': '🎉',
    'Saúde': '💊',
    'Supermercado': '🛒',
    'Outros': '📦'
  };

  container.innerHTML = items.map(item => `
    <div class="item-card">
      <div class="item-left">
        <div class="item-icon">${iconsMap[item.category] || '💰'}</div>
        <div class="item-info">
          <div class="item-title">${item.description}</div>
          <div class="item-subtitle">${formatDateBR(item.date_str)} • ${item.category} • ${item.payment_method || 'Pix'}</div>
        </div>
      </div>
      <div class="item-right">
        <div class="item-amount" style="color: #f87171;">-${formatBRL(item.amount)}</div>
        <div class="item-actions-row">
          <button class="icon-action-btn" onclick="editExpense(${item.id})" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-action-btn delete" onclick="deleteExpenseItem(${item.id})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>
  `).join('');
}

function filterExpensesList() {
  const search = document.getElementById('expenses-search-input').value.toLowerCase();
  const cat = document.getElementById('expenses-category-filter').value;

  const filtered = state.expenses.filter(item => {
    const matchesSearch = item.description.toLowerCase().includes(search) || item.category.toLowerCase().includes(search);
    const matchesCat = !cat || item.category === cat;
    return matchesSearch && matchesCat;
  });

  renderFullExpensesList(filtered);
}

// Salvar / Editar Gasto
async function handleExpenseSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('expense-id').value;
  const description = (document.getElementById('expense-desc').value || '').trim();
  const rawAmount = document.getElementById('expense-amount').value;
  const amount = parseAmount(rawAmount);
  const category = document.getElementById('expense-cat').value;
  const paymentMethod = document.getElementById('expense-method').value;
  const dateStr = document.getElementById('expense-date').value || new Date().toISOString().split('T')[0];

  if (!description) {
    alert('Por favor, informe a descrição do gasto.');
    return;
  }
  if (!amount || amount <= 0) {
    alert('Por favor, informe um valor válido maior que zero.');
    return;
  }

  try {
    let res;
    if (id) {
      // Atualizar
      res = await fetch(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, amount, category, paymentMethod, dateStr })
      });
    } else {
      // Criar novo
      res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, amount, category, paymentMethod, dateStr })
      });
    }

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Erro ao salvar gasto.');
      return;
    }

    closeModal('modal-expense');
    document.getElementById('form-expense').reset();
    document.getElementById('expense-id').value = '';
    document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];

    showFeedbackToast(data.message || `Gasto contabilizado: ${description} - ${formatBRL(amount)}`);

    await loadDashboard();
    await loadExpenses();
  } catch (err) {
    alert('Erro de conexão ao salvar gasto.');
  }
}

function editExpense(id) {
  const item = state.expenses.find(e => e.id === id);
  if (!item) return;

  document.getElementById('expense-id').value = item.id;
  document.getElementById('expense-desc').value = item.description;
  document.getElementById('expense-amount').value = item.amount;
  document.getElementById('expense-cat').value = item.category;
  document.getElementById('expense-method').value = item.payment_method || 'Pix';
  document.getElementById('expense-date').value = item.date_str;
  document.getElementById('modal-expense-title').textContent = 'Editar Gasto';
  document.getElementById('btn-save-expense').textContent = 'Salvar Alterações';

  openModal('modal-expense');
}

async function deleteExpenseItem(id) {
  if (!confirm('Deseja realmente excluir este gasto?')) return;
  try {
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      showFeedbackToast('Gasto excluído com sucesso.');
      await loadDashboard();
      await loadExpenses();
    }
  } catch (err) {
    alert('Erro ao excluir gasto.');
  }
}

// EXPORTAR EXCEL (.XLSX)
function exportExpensesToExcel() {
  if (!state.expenses || state.expenses.length === 0) {
    alert('Nenhum gasto para exportar neste mês.');
    return;
  }

  const rows = [
    ['Data', 'Descrição', 'Categoria', 'Forma de Pagamento', 'Valor (R$)']
  ];

  let totalSum = 0;
  state.expenses.forEach(item => {
    rows.push([
      formatDateBR(item.date_str),
      item.description,
      item.category,
      item.payment_method || 'Pix',
      Number(item.amount)
    ]);
    totalSum += Number(item.amount);
  });

  // Linha de Total
  rows.push([]);
  rows.push(['TOTAL GERAL', '', '', '', totalSum]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Ajuste de largura das colunas
  ws['!cols'] = [
    { wch: 14 },
    { wch: 30 },
    { wch: 18 },
    { wch: 20 },
    { wch: 16 }
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = `${MONTH_NAMES[state.month - 1]}_${state.year}`;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const fileName = `Gastos_Saulo_${MONTH_NAMES[state.month - 1]}_${state.year}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showFeedbackToast('Planilha Excel baixada com sucesso!');
}

// ========================================================
// 4. QUEM ME DEVE (DEVEDORES & FECHAMENTO WHATSAPP)
// ========================================================
async function loadDebtors() {
  try {
    const res = await fetch('/api/debtors');
    const data = await res.json();
    state.debtors = data || [];

    const totalPending = state.debtors.reduce((acc, curr) => acc + curr.total_pending, 0);
    document.getElementById('debtors-screen-total').textContent = formatBRL(totalPending);

    renderDebtorsCards(state.debtors);
  } catch (err) {
    console.error('Erro ao carregar devedores:', err);
  }
}

function renderDebtorsCards(debtors) {
  const container = document.getElementById('debtors-container');
  if (!container) return;

  if (!debtors || debtors.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px 0;">Nenhum devedor cadastrado. Toque no botão acima para adicionar uma pessoa.</p>';
    return;
  }

  container.innerHTML = debtors.map(d => {
    const total = d.total_debt || 0;
    const paid = d.total_paid || 0;
    const pending = d.total_pending || 0;
    const percentPaid = total > 0 ? Math.round((paid / total) * 100) : 0;
    const initial = (d.name || '?')[0].toUpperCase();

    return `
      <div class="debtor-card">
        <div class="debtor-top">
          <div class="debtor-profile">
            <div class="debtor-avatar">${initial}</div>
            <div>
              <div class="debtor-name">${d.name}</div>
              <div class="debtor-phone">${d.phone ? formatPhone(d.phone) : 'Sem WhatsApp cadastrado'}</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.1rem; font-weight: 800; color: ${pending > 0 ? '#f87171' : '#34d399'};">
              ${formatBRL(pending)}
            </div>
            <div style="display: flex; gap: 6px; justify-content: flex-end; margin-top: 4px;">
              <button class="icon-action-btn" onclick="editDebtorClick(${d.id})" title="Editar Pessoa"><i class="fa-solid fa-pen"></i></button>
              <button class="icon-action-btn delete" onclick="deleteDebtorClick(${d.id}, '${d.name.replace(/'/g, "\\'")}')" title="Excluir Pessoa"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        </div>

        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width: ${percentPaid}%;"></div>
        </div>

        <div class="debtor-stats-row">
          <span>Total Original: <strong>${formatBRL(total)}</strong></span>
          <span>Pago: <strong style="color: #34d399;">${formatBRL(paid)} (${percentPaid}%)</strong></span>
        </div>

        <div class="debtor-buttons">
          <button class="debtor-btn whatsapp" onclick="openWhatsAppClosingModal(${d.id})">
            <i class="fa-brands fa-whatsapp"></i> Cobrança do Mês
          </button>
          <button class="debtor-btn details" onclick="openDebtorDetails(${d.id})">
            <i class="fa-solid fa-list-check"></i> Ver Parcelas
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Abrir Modal de Fechamento do Mês para WhatsApp
function openWhatsAppClosingModal(debtorId) {
  const debtor = state.debtors.find(d => d.id === debtorId);
  if (!debtor) return;

  state.selectedDebtor = debtor;

  // Filtrar parcelas pendentes com vencimento neste mês selecionado
  const monthItems = [];
  let monthTotal = 0;

  if (debtor.items) {
    debtor.items.forEach(item => {
      if (item.installments) {
        item.installments.forEach(inst => {
          if (inst.due_year === state.year && inst.due_month === state.month && inst.status === 'PENDING') {
            monthItems.push({
              description: item.description,
              installmentNumber: inst.installment_number,
              totalInstallments: inst.total_installments,
              amount: inst.amount
            });
            monthTotal += inst.amount;
          }
        });
      }
    });
  }

  // Se não tiver parcela específica desse mês, pega todas as pendentes para não deixar zerado
  if (monthItems.length === 0 && debtor.total_pending > 0) {
    if (debtor.items) {
      debtor.items.forEach(item => {
        if (item.installments) {
          item.installments.forEach(inst => {
            if (inst.status === 'PENDING') {
              monthItems.push({
                description: item.description,
                installmentNumber: inst.installment_number,
                totalInstallments: inst.total_installments,
                amount: inst.amount
              });
              monthTotal += inst.amount;
            }
          });
        }
      });
    }
  }

  const monthName = MONTH_NAMES[state.month - 1];
  const userName = state.settings.user_name || 'Saulo';
  const pixKey = state.settings.pix_key || '06888505456';

  let itemsText = '';
  monthItems.forEach(it => {
    const installmentLabel = it.totalInstallments > 1 ? ` (Parcela ${it.installmentNumber}/${it.totalInstallments})` : '';
    itemsText += `• ${it.description}${installmentLabel}: ${formatBRL(it.amount)}\n`;
  });

  if (monthItems.length === 0) {
    itemsText = '• Nenhuma parcela pendente em aberto!\n';
  }

  // Montagem da Mensagem Solicitada pelo Saulo
  const message = 
`Olá ${debtor.name}, tudo bem?
Aqui é o ${userName}. Segue o fechamento das despesas de ${monthName}:

${itemsText}
💰 Total deste mês: ${formatBRL(monthTotal)}
🔑 Chave Pix: ${pixKey} (${userName})

Qualquer dúvida estou à disposição! Abraço.`;

  state.generatedWhatsAppText = message;
  state.generatedWhatsAppPhone = debtor.phone || '';

  document.getElementById('whatsapp-message-preview').textContent = message;
  openModal('modal-whatsapp-closing');
}

function copyWhatsAppMessage() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(state.generatedWhatsAppText).then(() => {
      showFeedbackToast('Texto copiado com sucesso!');
    });
  } else {
    alert('Texto selecionado: copie manualmente.');
  }
}

function sendWhatsAppNow() {
  const textEncoded = encodeURIComponent(state.generatedWhatsAppText);
  let rawPhone = (state.generatedWhatsAppPhone || '').replace(/\D/g, '');

  if (rawPhone) {
    // Adiciona código 55 do Brasil se necessário
    if (rawPhone.length <= 11) {
      rawPhone = '55' + rawPhone;
    }
    const url = `https://wa.me/${rawPhone}?text=${textEncoded}`;
    window.open(url, '_blank');
  } else {
    // Abre WhatsApp sem número para o usuário escolher o contato
    const url = `https://wa.me/?text=${textEncoded}`;
    window.open(url, '_blank');
  }
}

// Modal de Detalhes das Parcelas do Devedor
function openDebtorDetails(debtorId) {
  const debtor = state.debtors.find(d => d.id === debtorId);
  if (!debtor) return;

  state.selectedDebtor = debtor;

  document.getElementById('details-debtor-name').textContent = debtor.name;
  document.getElementById('details-debtor-phone').textContent = debtor.phone ? formatPhone(debtor.phone) : 'Sem telefone';
  document.getElementById('details-total-debt').textContent = formatBRL(debtor.total_debt);
  document.getElementById('details-total-paid').textContent = formatBRL(debtor.total_paid);
  document.getElementById('details-total-pending').textContent = formatBRL(debtor.total_pending);

  renderDebtsList(debtor);
  openModal('modal-debtor-details');
}

function renderDebtsList(debtor) {
  const container = document.getElementById('details-debts-list');
  if (!container) return;

  if (!debtor.items || debtor.items.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Nenhuma compra cadastrada para esta pessoa. Clique em "Nova Compra".</p>';
    return;
  }

  container.innerHTML = debtor.items.map(item => `
    <div class="glass-card" style="margin-bottom: 12px; padding: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div>
          <strong style="font-size: 0.95rem;">${item.description}</strong>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            Valor Total: ${formatBRL(item.total_amount)} (${item.installments_count}x)
          </div>
        </div>
        <button class="icon-action-btn delete" onclick="deleteDebtItemClick(${item.id})" title="Excluir Compra"><i class="fa-solid fa-trash"></i></button>
      </div>

      <div style="border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 8px;">
        ${(item.installments || []).map(inst => {
          const isPaid = inst.status === 'PAID';
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 0.82rem;">
              <span>
                <strong>${inst.installment_number}/${inst.total_installments}</strong> 
                <span style="color: var(--text-muted); margin-left: 6px;">Venc: ${formatDateBR(inst.due_date)}</span>
              </span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 700; color: ${isPaid ? '#34d399' : '#f87171'};">${formatBRL(inst.amount)}</span>
                <button class="btn-export" style="padding: 4px 8px; font-size: 0.72rem; ${isPaid ? 'background: rgba(16, 185, 129, 0.2); color: #34d399;' : 'background: rgba(239, 68, 68, 0.2); color: #f87171;'}" onclick="toggleInstallmentStatus(${inst.id}, ${!isPaid})">
                  ${isPaid ? '✅ Paga' : '⏳ Pagar'}
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}

async function toggleInstallmentStatus(installmentId, isPaid) {
  try {
    const res = await fetch(`/api/debtors/installments/${installmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPaid })
    });
    const data = await res.json();
    if (data.ok) {
      showFeedbackToast(isPaid ? 'Parcela marcada como PAGA!' : 'Parcela marcada como PENDENTE.');
      await loadDebtors();
      await loadDashboard();
      if (state.selectedDebtor) {
        const updated = state.debtors.find(d => d.id === state.selectedDebtor.id);
        if (updated) openDebtorDetails(updated.id);
      }
    }
  } catch (err) {
    alert('Erro ao atualizar status da parcela.');
  }
}

async function confirmPayAllDebtor() {
  if (!state.selectedDebtor) return;
  if (!confirm(`Deseja realmente quitar TODAS as parcelas de ${state.selectedDebtor.name}?`)) return;

  try {
    const res = await fetch(`/api/debtors/${state.selectedDebtor.id}/pay-all`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      showFeedbackToast('Todas as parcelas foram quitadas com sucesso!');
      await loadDebtors();
      await loadDashboard();
      const updated = state.debtors.find(d => d.id === state.selectedDebtor.id);
      if (updated) openDebtorDetails(updated.id);
    }
  } catch (err) {
    alert('Erro ao quitar parcelas.');
  }
}

function openNewDebtForCurrent() {
  if (!state.selectedDebtor) return;
  document.getElementById('debt-item-debtor-id').value = state.selectedDebtor.id;
  document.getElementById('debt-item-debtor-name').value = state.selectedDebtor.name;
  openModal('modal-debt-item');
}

async function handleDebtItemSubmit(event) {
  event.preventDefault();
  const debtorId = document.getElementById('debt-item-debtor-id').value;
  const description = document.getElementById('debt-item-desc').value;
  const totalAmount = parseFloat(document.getElementById('debt-item-amount').value);
  const installmentsCount = parseInt(document.getElementById('debt-item-installments').value, 10);
  const startDate = document.getElementById('debt-item-date').value;

  try {
    const res = await fetch(`/api/debtors/${debtorId}/debts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, totalAmount, installmentsCount, startDate })
    });
    const data = await res.json();
    if (data.ok) {
      showFeedbackToast(`Cobrança de ${formatBRL(totalAmount)} gerada em ${installmentsCount}x!`);
      closeModal('modal-debt-item');
      document.getElementById('form-debt-item').reset();
      await loadDebtors();
      await loadDashboard();
      if (state.selectedDebtor) {
        const updated = state.debtors.find(d => d.id === state.selectedDebtor.id);
        if (updated) openDebtorDetails(updated.id);
      }
    }
  } catch (err) {
    alert('Erro ao registrar cobrança.');
  }
}

async function deleteDebtItemClick(debtItemId) {
  if (!confirm('Deseja excluir este item e todas as suas parcelas?')) return;
  try {
    const res = await fetch(`/api/debtors/debts/${debtItemId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      showFeedbackToast('Item de dívida excluído.');
      await loadDebtors();
      await loadDashboard();
      if (state.selectedDebtor) {
        const updated = state.debtors.find(d => d.id === state.selectedDebtor.id);
        if (updated) openDebtorDetails(updated.id);
      }
    }
  } catch (err) {
    alert('Erro ao excluir item.');
  }
}

async function handleDebtorSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('debtor-id').value;
  const name = (document.getElementById('debtor-name').value || '').trim();
  const phone = (document.getElementById('debtor-phone').value || '').trim();
  const notes = (document.getElementById('debtor-notes').value || '').trim();

  if (!name) {
    alert('Por favor, informe o nome da pessoa.');
    return;
  }

  try {
    let res;
    if (id) {
      res = await fetch(`/api/debtors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, notes })
      });
    } else {
      res = await fetch('/api/debtors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, notes })
      });
    }

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Erro ao salvar pessoa.');
      return;
    }

    showFeedbackToast(id ? `Dados de ${name} atualizados!` : `Pessoa ${name} cadastrada com sucesso!`);
    closeModal('modal-debtor');
    document.getElementById('form-debtor').reset();
    document.getElementById('debtor-id').value = '';
    document.getElementById('modal-debtor-title').textContent = 'Cadastrar Pessoa';

    await loadDebtors();
    await loadDashboard();
  } catch (err) {
    alert('Erro de conexão ao salvar pessoa.');
  }
}

function editDebtorClick(debtorId) {
  const debtor = state.debtors.find(d => d.id === debtorId);
  if (!debtor) return;

  document.getElementById('debtor-id').value = debtor.id;
  document.getElementById('debtor-name').value = debtor.name;
  document.getElementById('debtor-phone').value = debtor.phone || '';
  document.getElementById('debtor-notes').value = debtor.notes || '';
  document.getElementById('modal-debtor-title').textContent = 'Editar Pessoa';
  openModal('modal-debtor');
}

async function deleteDebtorClick(debtorId, debtorName) {
  if (!confirm(`Deseja realmente excluir ${debtorName} e todas as suas compras e parcelas?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/debtors/${debtorId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Erro ao excluir pessoa.');
      return;
    }

    showFeedbackToast(`Pessoa ${debtorName} excluída com sucesso.`);
    await loadDebtors();
    await loadDashboard();
  } catch (err) {
    alert('Erro de conexão ao excluir pessoa.');
  }
}

async function deleteCurrentDebtorModal() {
  if (!state.selectedDebtor) return;
  const debtorId = state.selectedDebtor.id;
  const debtorName = state.selectedDebtor.name;

  if (!confirm(`Deseja realmente excluir ${debtorName} e todas as suas compras e parcelas?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/debtors/${debtorId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Erro ao excluir pessoa.');
      return;
    }

    closeModal('modal-debtor-details');
    showFeedbackToast(`Pessoa ${debtorName} excluída com sucesso.`);
    await loadDebtors();
    await loadDashboard();
  } catch (err) {
    alert('Erro de conexão ao excluir pessoa.');
  }
}

// ========================================================
// 5. GRÁFICOS & RELATÓRIOS (COM DOWNLOAD EM IMAGEM)
// ========================================================
async function loadCharts() {
  try {
    const res = await fetch(`/api/reports/stats?year=${state.year}&month=${state.month}`);
    const data = await res.json();

    renderCategoriesChart(data.expensesByCategory);
    renderExpensesMonthlyChart(data.expensesMonthly);
    renderDebtorsMonthlyChart(data.debtorsMonthly);
    renderDebtorsRankingChart(data.debtorsSummary);
  } catch (err) {
    console.error('Erro ao renderizar gráficos:', err);
  }
}

function renderCategoriesChart(categories) {
  const ctx = document.getElementById('chart-categories');
  if (!ctx) return;
  if (state.charts.categories) state.charts.categories.destroy();

  const labels = (categories || []).map(c => c.category);
  const values = (categories || []).map(c => c.total);

  if (labels.length === 0) {
    labels.push('Sem gastos');
    values.push(1);
  }

  state.charts.categories = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [
          '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } }
      }
    }
  });
}

function renderExpensesMonthlyChart(monthly) {
  const ctx = document.getElementById('chart-expenses-monthly');
  if (!ctx) return;
  if (state.charts.expensesMonthly) state.charts.expensesMonthly.destroy();

  const labels = (monthly || []).map(m => `${MONTH_NAMES[m.month - 1].substring(0, 3)}/${m.year}`);
  const values = (monthly || []).map(m => m.total);

  state.charts.expensesMonthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Gastos (R$)',
        data: values,
        backgroundColor: 'rgba(239, 68, 68, 0.75)',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderDebtorsMonthlyChart(debtorsMonthly) {
  const ctx = document.getElementById('chart-debtors-monthly');
  if (!ctx) return;
  if (state.charts.debtorsMonthly) state.charts.debtorsMonthly.destroy();

  const labels = (debtorsMonthly || []).map(m => `${MONTH_NAMES[m.month - 1].substring(0, 3)}/${m.year}`);
  const expected = (debtorsMonthly || []).map(m => m.total_expected);
  const received = (debtorsMonthly || []).map(m => m.total_received);

  state.charts.debtorsMonthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'A Receber',
          data: expected,
          backgroundColor: 'rgba(59, 130, 246, 0.75)',
          borderRadius: 8
        },
        {
          label: 'Já Recebido',
          data: received,
          backgroundColor: 'rgba(16, 185, 129, 0.75)',
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
      },
      plugins: {
        legend: { labels: { color: '#94a3b8' } }
      }
    }
  });
}

function renderDebtorsRankingChart(debtors) {
  const ctx = document.getElementById('chart-debtors-ranking');
  if (!ctx) return;
  if (state.charts.debtorsRanking) state.charts.debtorsRanking.destroy();

  const activeDebtors = (debtors || []).filter(d => d.total_pending > 0);
  const labels = activeDebtors.map(d => d.name);
  const values = activeDebtors.map(d => d.total_pending);

  if (labels.length === 0) {
    labels.push('Sem devedores pendentes');
    values.push(1);
  }

  state.charts.debtorsRanking = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [
          '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } }
      }
    }
  });
}

// Download de Gráfico Individual em PNG
function downloadSingleChart(canvasId, name) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const imageUri = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `${name}_Saulo_${MONTH_NAMES[state.month - 1]}_${state.year}.png`;
  link.href = imageUri;
  link.click();
  showFeedbackToast('Gráfico salvo como imagem!');
}

function downloadAllCharts() {
  downloadSingleChart('chart-categories', 'Gastos_Por_Categoria');
  setTimeout(() => downloadSingleChart('chart-expenses-monthly', 'Evolucao_Mensal_Gastos'), 400);
  setTimeout(() => downloadSingleChart('chart-debtors-monthly', 'Devedores_Comparativo'), 800);
}

// ========================================================
// 6. AJUSTES, RENDA & CONTAS FIXAS
// ========================================================
async function loadSettingsData() {
  await loadFixedExpenses();
  await loadIncomes();
}

async function loadFixedExpenses() {
  try {
    const res = await fetch(`/api/fixed-expenses?year=${state.year}&month=${state.month}`);
    const list = await res.json();
    const container = document.getElementById('settings-fixed-list');

    if (!list || list.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem;">Nenhuma conta fixa cadastrada.</p>';
      return;
    }

    container.innerHTML = list.map(item => `
      <div class="item-card">
        <div class="item-left">
          <div class="item-icon">🏠</div>
          <div class="item-info">
            <div class="item-title">${item.name}</div>
            <div class="item-subtitle">Vence dia ${item.due_day} • ${item.category || 'Moradia'}</div>
          </div>
        </div>
        <div class="item-right">
          <div class="item-amount">${formatBRL(item.amount)}</div>
          <div class="item-actions-row">
            <button class="btn-export" style="padding: 4px 8px; font-size: 0.72rem; ${item.is_paid ? 'background: rgba(16, 185, 129, 0.2); color: #34d399;' : 'background: rgba(245, 158, 11, 0.2); color: #f59e0b;'}" onclick="toggleFixedPayment(${item.id}, ${!item.is_paid})">
              ${item.is_paid ? '✅ Paga' : '⏳ A Pagar'}
            </button>
            <button class="icon-action-btn delete" onclick="deleteFixedItem(${item.id})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Erro ao carregar contas fixas:', err);
  }
}

async function toggleFixedPayment(id, isPaid) {
  try {
    await fetch(`/api/fixed-expenses/${id}/toggle-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: state.year, month: state.month, isPaid })
    });
    await loadFixedExpenses();
    await loadDashboard();
  } catch (err) {
    alert('Erro ao alterar status da conta.');
  }
}

async function deleteFixedItem(id) {
  if (!confirm('Deseja excluir esta conta fixa?')) return;
  try {
    await fetch(`/api/fixed-expenses/${id}`, { method: 'DELETE' });
    await loadFixedExpenses();
    await loadDashboard();
  } catch (err) {
    alert('Erro ao excluir conta.');
  }
}

async function handleFixedExpenseSubmit(event) {
  event.preventDefault();
  const name = (document.getElementById('fixed-name').value || '').trim();
  const rawAmount = document.getElementById('fixed-amount').value;
  const amount = parseAmount(rawAmount);
  const dueDay = parseInt(document.getElementById('fixed-day').value, 10) || 10;
  const category = (document.getElementById('fixed-category').value || '').trim() || 'Moradia';

  if (!name) {
    alert('Por favor, informe o nome da conta.');
    return;
  }
  if (!amount || amount <= 0) {
    alert('Por favor, informe um valor válido maior que zero.');
    return;
  }

  try {
    const res = await fetch('/api/fixed-expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, amount, dueDay, category })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Erro ao cadastrar conta fixa.');
      return;
    }

    closeModal('modal-fixed-expense');
    document.getElementById('form-fixed-expense').reset();
    showFeedbackToast('Conta fixa cadastrada com sucesso!');

    await loadFixedExpenses();
    await loadDashboard();
  } catch (err) {
    alert('Erro de conexão ao salvar conta fixa.');
  }
}

// Rendas
async function loadIncomes() {
  try {
    const res = await fetch(`/api/incomes?year=${state.year}&month=${state.month}`);
    const list = await res.json();
    const container = document.getElementById('settings-incomes-list');

    if (!list || list.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem;">Nenhuma renda cadastrada para este mês.</p>';
      return;
    }

    container.innerHTML = list.map(item => `
      <div class="item-card">
        <div class="item-left">
          <div class="item-icon">💵</div>
          <div class="item-info">
            <div class="item-title">${item.description}</div>
            <div class="item-subtitle">${MONTH_NAMES[item.month - 1]}/${item.year}</div>
          </div>
        </div>
        <div class="item-right">
          <div class="item-amount" style="color: #34d399;">+${formatBRL(item.amount)}</div>
          <div class="item-actions-row">
            <button class="icon-action-btn delete" onclick="deleteIncomeItem(${item.id})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Erro ao carregar rendas:', err);
  }
}

async function handleIncomeSubmit(event) {
  event.preventDefault();
  const description = (document.getElementById('income-desc').value || '').trim();
  const rawAmount = document.getElementById('income-amount').value;
  const amount = parseAmount(rawAmount);

  if (!description) {
    alert('Por favor, informe a descrição da renda.');
    return;
  }
  if (!amount || amount <= 0) {
    alert('Por favor, informe um valor válido maior que zero.');
    return;
  }

  try {
    const res = await fetch('/api/incomes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: state.year,
        month: state.month,
        description,
        amount
      })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Erro ao cadastrar renda.');
      return;
    }

    closeModal('modal-income');
    document.getElementById('form-income').reset();
    showFeedbackToast('Renda registrada com sucesso!');

    await loadIncomes();
    await loadDashboard();
  } catch (err) {
    alert('Erro de conexão ao cadastrar renda.');
  }
}

async function deleteIncomeItem(id) {
  if (!confirm('Deseja excluir esta renda?')) return;
  try {
    await fetch(`/api/incomes/${id}`, { method: 'DELETE' });
    await loadIncomes();
    await loadDashboard();
  } catch (err) {
    alert('Erro ao excluir renda.');
  }
}

// ========================================================
// FUNÇÕES UTILITÁRIAS & MODAIS
// ========================================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    const todayStr = new Date().toISOString().split('T')[0];
    if (modalId === 'modal-expense') {
      const el = document.getElementById('expense-date');
      if (el && !el.value) el.value = todayStr;
    } else if (modalId === 'modal-debt-item') {
      const el = document.getElementById('debt-item-date');
      if (el && !el.value) el.value = todayStr;
    }
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function closeModalOnOverlay(event, modalId) {
  if (event.target.id === modalId) {
    closeModal(modalId);
  }
}

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function formatPhone(phone) {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11) {
    return `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.substring(0, 2)}) ${clean.substring(2, 6)}-${clean.substring(6)}`;
  }
  return phone;
}
