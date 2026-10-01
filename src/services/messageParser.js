/**
 * Categorias automáticas por palavras-chave comuns
 */
const CATEGORY_KEYWORDS = {
  'Alimentação': ['almoço', 'almoco', 'jantar', 'lanche', 'restaurante', 'ifood', 'pizza', 'burger', 'hamburguer', 'cafe', 'café', 'padaria', 'sorvete', 'açougue', 'acougue'],
  'Mercado': ['mercado', 'supermercado', 'compras', 'hortifruti', 'atacadão', 'atacadao', 'carrefour', 'pão de açúcar', 'assai'],
  'Transporte': ['gasolina', 'combustivel', 'combustível', 'uber', '99', 'taxi', 'estacionamento', 'pedagio', 'pedágio', 'onibus', 'ônibus', 'metro', 'metrô', 'abastecer'],
  'Saúde': ['farmacia', 'farmácia', 'drogaria', 'remedio', 'remédio', 'medico', 'médico', 'consulta', 'dentista', 'exame', 'terapia', 'hospital'],
  'Lazer': ['bar', 'cerveja', 'chope', 'festa', 'balada', 'cinema', 'filme', 'jogo', 'steam', 'playstation', 'xbox', 'netflix', 'spotify', 'show', 'praia', 'passeio'],
  'Vestuário': ['roupa', 'camisa', 'camiseta', 'calça', 'calca', 'tenis', 'tênis', 'sapato', 'loja', 'shopping'],
  'Casa / Moradia': ['luz', 'energia', 'agua', 'água', 'gas', 'gás', 'internet', 'aluguel', 'condominio', 'condomínio', 'reforma', 'ferramenta', 'faxina'],
  'Educação': ['livro', 'curso', 'faculdade', 'escola', 'material', 'apostila']
};

function inferCategory(text) {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return category;
      }
    }
  }
  // Se não encontrar nas palavras-chave, capitaliza a primeira palavra significativa
  const words = text.split(/\s+/).filter(w => w.length > 2);
  if (words.length > 0) {
    const first = words[0];
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }
  return 'Outros';
}

function parseMoneyValue(valStr) {
  if (!valStr) return null;
  // Limpa R$, espaços e converte vírgula decimal para ponto
  let cleaned = valStr.replace(/R\$/gi, '').trim();
  // Se tiver formato tipo 1.250,50
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}

class MessageParser {
  parse(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return { type: 'UNKNOWN', raw: rawText };
    }

    const text = rawText.trim();
    const lower = text.toLowerCase();

    // 1. Comandos do Sistema
    if (lower === 'ajuda' || lower === '!ajuda' || lower === 'help' || lower === 'comandos' || lower === 'menu') {
      return { type: 'COMMAND', command: 'HELP' };
    }
    if (lower === 'saldo' || lower === '!saldo' || lower === 'resumo' || lower === 'status') {
      return { type: 'COMMAND', command: 'BALANCE' };
    }
    if (lower === 'semanal' || lower === '!semanal') {
      return { type: 'COMMAND', command: 'REPORT_WEEKLY' };
    }
    if (lower === 'quinzenal' || lower === '!quinzenal') {
      return { type: 'COMMAND', command: 'REPORT_QUINZENAL' };
    }
    if (lower === 'mensal' || lower === '!mensal' || lower === 'relatorio' || lower === '!relatorio' || lower === 'relatório') {
      return { type: 'COMMAND', command: 'REPORT_MONTHLY' };
    }
    if (lower === 'extrato' || lower === '!extrato' || lower === 'ultimos' || lower === 'histórico' || lower === 'historico') {
      return { type: 'COMMAND', command: 'EXTRATO' };
    }
    if (lower === 'configurar' || lower === 'iniciar' || lower === 'comecar' || lower === 'começar' || lower === 'zerar') {
      return { type: 'COMMAND', command: 'CONFIG' };
    }
    if (lower === 'fixas' || lower === 'despesas fixas') {
      return { type: 'COMMAND', command: 'FIXED_LIST' };
    }

    // Comando apagar: ex "apagar 12" ou "!apagar 12"
    const deleteMatch = text.match(/^(?:!?(?:apagar|deletar|remover|excluir))\s+(\d+)$/i);
    if (deleteMatch) {
      return { type: 'COMMAND', command: 'DELETE_EXPENSE', id: parseInt(deleteMatch[1], 10) };
    }

    // 2. Tentar identificar gasto financeiro
    // Formato A: "Mercado 85,50", "Almoço R$ 35,00", "Gasolina 120 posto"
    // Expressão que procura valor no final ou no meio
    const regexValueEnd = /^(.*?)(?:\s+R\$|\s+)\s*(\d+(?:[.,]\d{1,2})?)\s*(.*)$/i;
    // Formato B: "85,50 Mercado", "R$ 120 Gasolina"
    const regexValueStart = /^(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)\s+(.*)$/i;

    let match = text.match(regexValueStart);
    if (match) {
      const val = parseMoneyValue(match[1]);
      const desc = match[2].trim();
      if (val && desc) {
        return {
          type: 'EXPENSE',
          amount: val,
          category: inferCategory(desc),
          description: desc,
          raw: text
        };
      }
    }

    match = text.match(regexValueEnd);
    if (match) {
      const prefix = match[1].trim();
      const valStr = match[2].trim();
      const suffix = match[3].trim();
      const val = parseMoneyValue(valStr);

      if (val && (prefix || suffix)) {
        const fullDesc = [prefix, suffix].filter(Boolean).join(' ');
        return {
          type: 'EXPENSE',
          amount: val,
          category: inferCategory(fullDesc),
          description: fullDesc,
          raw: text
        };
      }
    }

    // Se não reconheceu comando nem gasto
    return {
      type: 'TEXT',
      text: text
    };
  }

  // Parse de despesas fixas (ex: "Aluguel 1500" ou lista com várias)
  parseFixedExpenseLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;
    
    // Procura número no final ou no início
    const endMatch = trimmed.match(/^(.*?)(?:\s+R\$|\s+)\s*(\d+(?:[.,]\d{1,2})?)$/i);
    if (endMatch) {
      const name = endMatch[1].trim();
      const val = parseMoneyValue(endMatch[2]);
      if (name && val) return { name, amount: val };
    }

    const startMatch = trimmed.match(/^(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)\s+(.*)$/i);
    if (startMatch) {
      const val = parseMoneyValue(startMatch[1]);
      const name = startMatch[2].trim();
      if (name && val) return { name, amount: val };
    }

    return null;
  }
}

module.exports = new MessageParser();
