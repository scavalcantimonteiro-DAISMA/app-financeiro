# MEMÓRIA & CONTEXTO COMPLETO DO PROJETO - FINANÇAS SAULO (PWA iOS)

> **Atenção Antigravity / IA:** Este arquivo contém todo o histórico de arquitetura e funcionamento do novo aplicativo financeiro de Saulo Monteiro. Ao abrir este projeto em qualquer máquina nova, utilize este documento como guia definitivo.

---

## 1. Visão Geral do Sistema
O **APP Financeiro Saulo** é um sistema moderno de gestão financeira pessoal e cobrança inteligente, desenvolvido especialmente como **PWA (Progressive Web App) no padrão visual Apple iOS 18**.
* **Tecnologias:** Node.js (v24), Express, SQLite3 nativo (`DatabaseSync`), Chart.js, SheetJS (XLSX), Tailwind CSS/Custom Glassmorphism Apple, Service Worker / PWA.
* **Chave Pix Padrão:** `06888505456`
* **Usuário:** Saulo

---

## 2. Destaques da Arquitetura

1. **Preenchimento Automático de Recebíveis de Terceiros:**
   - O Dashboard e os relatórios varrem as dívidas e parcelas geradas no módulo de devedores (`debt_installments`).
   - Todas as parcelas com vencimento no mês selecionado são somadas e discriminadas automaticamente (Nome, Compra, Parcela e Valor).
2. **Cobrança do Mês no WhatsApp:**
   - Botão no card do devedor que compila as despesas e parcelas daquele mês, formata o texto com a chave Pix do Saulo e abre diretamente no WhatsApp (`wa.me/55...`).
3. **Feedback Instantâneo de Gastos:**
   - Notificação em destaque no topo + tom sonoro suave estilo Apple Pay: *"Gasto contabilizado: [descrição] - R$ [valor]"*.
4. **Exportação Excel (.xlsx):**
   - Gera e faz download direto no iPhone/PC de planilhas formatadas com linha de total geral somado.
5. **Gráficos e Download de Imagem:**
   - 4 gráficos interativos (Categorias, Evolução de Gastos, Comparativo de Devedores, Ranking) com botão para salvar imagem PNG.

---

## 3. Estrutura do Banco de Dados (`financeiro.db`)
- `app_settings`: Parâmetros de usuário e Chave Pix.
- `incomes`: Rendas do mês.
- `fixed_expenses`: Contas fixas recorrentes.
- `fixed_expense_payments`: Status de quitação mensal das contas fixas.
- `expenses`: Despesas e gastos diários.
- `debtors`: Pessoas cadastradas.
- `debt_items`: Compras e dívidas cadastradas por pessoa.
- `debt_installments`: Parcelas individuais com data de vencimento, mês, ano, valor e status (PENDING/PAID).
