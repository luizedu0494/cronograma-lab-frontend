/**
 * NotificadorTelegram.js
 * Versão Simplificada (Texto Puro) para corrigir Erro 400
 */

class NotificadorTelegram {
  constructor() {
    this.botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;
    this.apiUrl = 'https://api.telegram.org';
  }

  async enviarNotificacao(chatId, dados, tipo) {
    // Validações iniciais
    if (!this.botToken) {
      console.error('ERRO TELEGRAM: Token vazio.');
      return false;
    }
    if (!chatId) {
      console.warn('AVISO TELEGRAM: Chat ID vazio.');
      return false;
    }

    try {
      // Gera mensagem em Texto Puro (sem HTML)
      const mensagem = this.gerarMensagemTexto(dados, tipo);
      const url = `${this.apiUrl}/bot${this.botToken}/sendMessage`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: mensagem,
          // REMOVIDO parse_mode: 'HTML' para evitar erros de formatação
          disable_web_page_preview: true
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        // AQUI ESTÁ O SEGREDO: Mostra exatamente por que o Telegram rejeitou
        console.error('❌ ERRO TELEGRAM API:', responseData.description); 
        return false;
      }

      console.log('✅ SUCESSO TELEGRAM:', responseData);
      return true;
    } catch (error) {
      console.error('❌ Erro de Rede Telegram:', error);
      return false;
    }
  }

  gerarMensagemTexto(dados, tipo) {
    // Garante que nada seja undefined
    const dataFormatada = dados.data || 'Data n/a';
    const horario = Array.isArray(dados.horario) ? dados.horario.join(', ') : (dados.horario || 'Horário n/a');
    const laboratorio = dados.laboratorio || 'Lab n/a';
    const assunto = dados.assunto || 'Sem assunto';
    const cursos = Array.isArray(dados.cursos) ? dados.cursos.join(', ') : (dados.cursos || 'Cursos n/a');

    let titulo = '';
    let emoji = '';

    switch (tipo) {
      case 'adicionar':
        titulo = 'NOVA AULA ADICIONADA';
        emoji = '✅';
        break;
      case 'editar':
        titulo = 'AULA EDITADA';
        emoji = '✏️';
        break;
      case 'excluir':
        titulo = 'AULA EXCLUÍDA';
        emoji = '🗑️';
        break;
      default:
        titulo = 'NOTIFICAÇÃO';
        emoji = '📢';
    }

    // Formatação simples sem tags HTML
    return `
${emoji} ${titulo}

📖 Assunto: ${assunto}
📅 Data: ${dataFormatada}
🕐 Horário: ${horario}
🏢 Laboratório: ${laboratorio}
👥 Cursos: ${cursos}

${dados.observacoes ? `📝 Obs: ${dados.observacoes}` : ''}
    `.trim();
  }

  // Mantém compatibilidade
  async enviarParaMultiplos(chatIds, dados, tipo) {
    if (!Array.isArray(chatIds) || chatIds.length === 0) return { sucesso: 0, falha: 0 };
    const resultados = await Promise.all(chatIds.map(id => this.enviarNotificacao(id, dados, tipo)));
    return { sucesso: resultados.filter(r => r).length, falha: resultados.filter(r => !r).length };
  }
}

export const notificadorTelegram = new NotificadorTelegram();
export default NotificadorTelegram;