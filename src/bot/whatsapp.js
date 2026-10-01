const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const conversationManager = require('../services/conversationManager');
const cronJobs = require('../scheduler/cronJobs');

class WhatsAppBot {
  constructor() {
    this.sock = null;
    this.status = 'DISCONNECTED'; // 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED'
    this.qrCodeDataUrl = null;
    this.userJid = null;
    this.targetChatJid = null;
    this.sentMessageIds = new Set();
    this.groupNameCache = new Map();
  }

  getStatus() {
    return {
      status: this.status,
      qrCodeDataUrl: this.qrCodeDataUrl,
      userJid: this.userJid,
      targetChatJid: this.targetChatJid
    };
  }

  async start() {
    this.status = 'CONNECTING';
    console.log('\n🚀 Iniciando módulo de conexão com WhatsApp...');

    try {
      const { state, saveCreds } = await useMultiFileAuthState(config.AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['APP Financeiro Saulo', 'Chrome', '1.0.0']
      });

      // Atualiza cron com o cliente WhatsApp
      cronJobs.setWhatsAppClient(this.sock);

      // Evento de credenciais atualizadas
      this.sock.ev.on('creds.update', saveCreds);

      // Evento de atualização de conexão
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.status = 'QR_READY';
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 7 });
          } catch (e) {
            console.error('Erro ao gerar QR Code Data URL:', e.message);
          }

          console.log('\n╔════════════════════════════════════════════════════════╗');
          console.log('║       📱 ESCANEIE O QR CODE NO SEU WHATSAPP            ║');
          console.log('║  (WhatsApp > Aparelhos Conectados > Conectar Aparelho)  ║');
          console.log('║                                                        ║');
          console.log('║  Ou acesse http://localhost:3000 para escanear na tela ║');
          console.log('╚════════════════════════════════════════════════════════╝\n');
          qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'open') {
          this.status = 'CONNECTED';
          this.qrCodeDataUrl = null;
          this.userJid = this.sock.user?.id;
          console.log('\n🟢 WHATSAPP CONECTADO COM SUCESSO!');
          console.log(`👤 Usuário Conectado: ${this.userJid}`);

          // Pré-carrega todos os grupos para detectar imediatamente o grupo 'APP FINANCEIRO SAULO'
          try {
            const groups = await this.sock.groupFetchAllParticipating();
            for (const [jid, group] of Object.entries(groups)) {
              if (group && group.subject) {
                this.groupNameCache.set(jid, group.subject);
                const subLower = group.subject.toLowerCase().trim();
                if (subLower.includes('app financeiro saulo') || subLower === 'app financeiro saulo') {
                  this.targetChatJid = jid;
                  cronJobs.setTargetChatJid(jid);
                  console.log(`🎯 Grupo Oficial Detectado: "${group.subject}" [${jid}]`);
                }
              }
            }
          } catch (e) {
            console.log('Busca de grupos sob demanda ativa.');
          }

          console.log('💬 O bot está pronto e responderá EXCLUSIVAMENTE no grupo APP FINANCEIRO SAULO!\n');
        }

        if (connection === 'close') {
          this.status = 'DISCONNECTED';
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`🔴 Conexão encerrada. Motivo: ${statusCode || 'Desconhecido'}. Reconectar: ${shouldReconnect}`);

          if (shouldReconnect) {
            setTimeout(() => this.start(), 3000);
          } else {
            console.log('⚠️ Sessão desconectada pelo usuário. Limpando credenciais...');
            this.clearSession();
            setTimeout(() => this.start(), 2000);
          }
        }
      });

      // Ouvinte de mensagens recebidas
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const m of messages) {
          try {
            await this.processMessage(m);
          } catch (err) {
            console.error('Erro ao processar mensagem do WhatsApp:', err);
          }
        }
      });

    } catch (err) {
      console.error('Erro ao iniciar conexão WhatsApp:', err);
      this.status = 'DISCONNECTED';
      setTimeout(() => this.start(), 5000);
    }
  }

  async getGroupName(chatId) {
    if (this.groupNameCache.has(chatId)) {
      return this.groupNameCache.get(chatId);
    }
    try {
      const meta = await this.sock.groupMetadata(chatId);
      if (meta && meta.subject) {
        this.groupNameCache.set(chatId, meta.subject);
        return meta.subject;
      }
    } catch (err) {
      // Falha ao obter metadados do grupo
    }
    return '';
  }

  async isAllowedChat(m, chatId) {
    // 1. Descartar transmissões, stories e canais de notícias do WhatsApp
    if (!chatId || chatId === 'status@broadcast' || chatId.endsWith('@newsletter')) {
      return false;
    }

    // 2. Se for um GRUPO (@g.us)
    if (chatId.endsWith('@g.us')) {
      const groupName = await this.getGroupName(chatId);
      const lower = (groupName || '').toLowerCase().trim();

      // Palavras permitidas para o grupo financeiro
      const isFinanceGroup =
        lower.includes('financeiro') ||
        lower.includes('finança') ||
        lower.includes('financas') ||
        lower.includes('gastos') ||
        lower.includes('despesa') ||
        lower.includes('orçamento') ||
        lower.includes('orcamento') ||
        (config.TARGET_GROUP_NAME && lower.includes(config.TARGET_GROUP_NAME.toLowerCase().trim()));

      if (!isFinanceGroup) {
        // Silenciosamente ignora qualquer grupo não-financeiro (Igreja, Família, Trabalho, etc.)
        return false;
      }

      console.log(`🎯 [CANAL AUTORIZADO] Grupo de finanças identificado: "${groupName}"`);
      return true;
    }

    // 3. Se for CONVERSA PRIVADA (1 para 1)
    // O bot SÓ deve interagir se for a conversa do Saulo consigo mesmo ("Você")!
    // Se outro contato qualquer mandar mensagem no privado do Saulo, JAMAIS responder!
    if (!m.key.fromMe) {
      return false;
    }

    // Verifica se é conversa consigo mesmo
    const myPhone = (this.userJid || this.sock?.user?.id || '').split(':')[0].split('@')[0];
    const chatPhone = chatId.split(':')[0].split('@')[0];

    if (myPhone && chatPhone === myPhone) {
      return true;
    }

    // Se Saulo mandou mensagem privada para um amigo/familiar, não interfere
    return false;
  }

  async processMessage(m) {
    if (!m.message) return;

    const chatId = m.key.remoteJid;
    if (!chatId) return;

    // Se a mensagem foi disparada por este próprio socket (evita loop infinito)
    if (this.sentMessageIds.has(m.key.id)) {
      this.sentMessageIds.delete(m.key.id);
      return;
    }

    // Filtro estrito de canal: APENAS grupo financeiro ou conversa consigo mesmo
    const allowed = await this.isAllowedChat(m, chatId);
    if (!allowed) {
      return;
    }

    // Extrai o texto da mensagem
    const text = 
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      '';

    if (!text || !text.trim()) return;

    // Proteção adicional contra respostas de bot
    const trimmed = text.trim();
    if (
      trimmed.startsWith('✅ *Gasto Registrado!') ||
      trimmed.startsWith('✅ *Registrado') ||
      trimmed.startsWith('📊 *APP FINANCEIRO') ||
      trimmed.startsWith('👋 *Olá, Saulo!') ||
      trimmed.startsWith('⚙️ *CONFIGURAÇÃO') ||
      trimmed.startsWith('➕ *Adicionada') ||
      trimmed.startsWith('🎉 *CONFIGURAÇÃO') ||
      trimmed.startsWith('🤔 Não entendi') ||
      trimmed.startsWith('💡 Não entendi') ||
      trimmed.startsWith('🤖 *APP FINANCEIRO') ||
      trimmed.startsWith('🔒 *DESPESAS') ||
      trimmed.startsWith('🗑️ *Gasto') ||
      trimmed.startsWith('📢 *RELATÓRIO') ||
      trimmed.startsWith('📈 *RELATÓRIO') ||
      trimmed.startsWith('🌓 *RELATÓRIO') ||
      trimmed.startsWith('📑 *RELATÓRIO') ||
      trimmed.startsWith('📋 *ÚLTIMOS')
    ) {
      return;
    }

    console.log(`📩 Mensagem recebida [${chatId}]: "${trimmed}"`);

    // Atualiza o destino padrão de mensagens cron (último chat ativo)
    this.targetChatJid = chatId;
    cronJobs.setTargetChatJid(chatId);

    // Processa pelo gerenciador de conversa
    const reply = await conversationManager.handleMessage(chatId, trimmed);
    if (reply) {
      const sent = await this.sock.sendMessage(chatId, { text: reply }, { quoted: m });
      if (sent?.key?.id) {
        this.sentMessageIds.add(sent.key.id);
      }
      console.log(`📤 Resposta enviada com sucesso para [${chatId}].`);
    }
  }

  clearSession() {
    if (fs.existsSync(config.AUTH_DIR)) {
      try {
        fs.rmSync(config.AUTH_DIR, { recursive: true, force: true });
        console.log('🧹 Pasta de autenticação auth_info_baileys limpa com sucesso.');
      } catch (e) {
        console.error('Erro ao limpar pasta de autenticação:', e.message);
      }
    }
  }

  async logoutAndRestart() {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch {}
    this.clearSession();
    this.status = 'DISCONNECTED';
    this.qrCodeDataUrl = null;
    this.userJid = null;
    setTimeout(() => this.start(), 1000);
  }
}

module.exports = new WhatsAppBot();
