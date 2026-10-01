# 📱 APP FINANCEIRO SAULO (iOS PWA & NUVEM)

> **Aplicativo de Gestão Financeira Pessoal, Cobrança de Devedores e Fechamento Mensal no WhatsApp.**
> Desenvolvido com padrão visual inspirado no **Apple iOS 18**, design responsivo para iPhone, suporte offline/PWA e banco de dados SQLite nativo.

---

## ✨ Principais Funcionalidades

### 1. 🏠 Início (Dashboard Inteligente)
- **Sobra Livre Projetada:** Saldo calculado em tempo real:
  $$\text{Sobra Livre} = (\text{Renda} + \text{Valores a Receber}) - (\text{Contas Fixas} + \text{Gastos Variáveis})$$
- **Valores a Receber de Terceiros (Preenchimento Automático):** O sistema varre as dívidas e parcelas cadastradas no módulo de devedores que vencem no mês selecionado e exibe o total e a lista detalhada com nome, descrição, parcela e valor!
- Seletor de mês/ano para navegação rápida em meses anteriores ou futuros.
- Acesso rápido a novos gastos, cobranças e gráficos.

### 2. 💳 Gastos (Despesas & Excel)
- Formulário ágil de registro (Descrição, Valor R$, Categoria, Forma de Pagamento e Data).
- **Feedback solicitado:** Toast animado com confirmação sonoro-visual imediata:
  > *"✅ Gasto contabilizado: [descrição] - R$ [valor]"*
- Listagem completa item a item com busca por descrição, filtros de categoria e totalizador geral.
- Ações completas para **Editar** e **Excluir** qualquer lançamento.
- **Exportação para Excel (.xlsx):** Gera planilha real com colunas estilizadas e linha de total geral somado.

### 3. 👥 Quem me Deve (Devedores, Parcelas & WhatsApp)
- Cartões individuais para cada devedor com foto/avatar, valor total devido, valor pago, saldo em aberto e barra de progresso visual (% quitado).
- Cadastro de compras à vista ou parceladas (1x até 12x) com cálculo automático das parcelas e vencimentos mensais.
- Controle individual de cada parcela: marcar como **PAGA** ou **PENDENTE** com data, ou botão **Quitar Tudo**.
- **🚀 Fechamento Mensal para o WhatsApp:**
  - Botão no card do devedor que reúne todas as despesas daquele mês com descrição, número de parcela e valor.
  - Mensagem formatada com a chave Pix do Saulo (`06888505456`).
  - Botão que abre diretamente a conversa da pessoa no WhatsApp com o texto pronto para envio.

### 4. 📊 Gráficos & Relatórios
- **Gastos por Categoria:** Gráfico Donut interativo.
- **Evolução Mensal do Consumo:** Gráfico de barras comparando meses.
- **Quem me Deve - Comparativo Mensal:** Projeção mês a mês dos valores a receber.
- **Divisão de Devedores:** Gráfico de pizza com os maiores saldos em aberto.
- **Download dos Gráficos:** Botão para baixar imagens PNG de alta resolução para salvar na galeria do iPhone.

### 5. ⚙️ Ajustes, Renda & Contas Fixas
- Configuração do Nome (`Saulo`) e Chave Pix (`06888505456`).
- Cadastro de Rendas do mês (Salário, Extras).
- Gestão de Contas Fixas com dia de vencimento e marcação de status (Paga / A Pagar).

---

## 📲 Como instalar no iPhone (Safari)

1. Abra o link do app no **Safari** do iPhone.
2. Toque no ícone de **Compartilhar** (quadrado com seta para cima).
3. Role a lista e toque em **"Adicionar à Tela de Início"**.
4. Toque em **"Adicionar"**.
5. O app terá seu próprio ícone na tela do iPhone e abrirá em **tela cheia sem barras de navegador**!

---

## 🚀 Como Iniciar no Computador

1. Dê duplo clique no arquivo **`iniciar_app.bat`** (ou rode `npm start` no terminal).
2. O aplicativo abrirá automaticamente em `http://localhost:3000`.
3. Para acessar no seu iPhone pela mesma rede Wi-Fi da sua casa, abra o Safari e digite:
   `http://192.168.1.188:3000` (ou o IP do seu computador na rede).

---

## 🌐 Publicação na Nuvem (Render / Vercel / Railway)

O projeto já inclui o arquivo `render.yaml`. Para colocar online 24h gratuitamente:
1. Suba esta pasta para um repositório no GitHub.
2. Acesse [render.com](https://render.com) e crie um novo **Web Service** conectado ao seu repositório.
3. Ele detectará as configurações automaticamente e gerará um link `https://financas-saulo.onrender.com` que você pode acessar de qualquer lugar do mundo no seu iPhone!
