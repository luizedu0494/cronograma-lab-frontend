class NotificadorTelegram {
  constructor() {
    this.botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;
    this.apiUrl = 'https://api.telegram.org';
  }

  async enviarNotificacao(chatId, dados, tipo) {
    if (!this.botToken || !chatId) return false;

    try {
      const mensagem = this.gerarMensagemTexto(dados, tipo);
      const url = `${this.apiUrl}/bot${this.botToken}/sendMessage`;

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: mensagem,
          disable_web_page_preview: true
        })
      });
      return true;
    } catch (error) {
      console.error('Erro Telegram:', error);
      return false;
    }
  }

  gerarMensagemTexto(dados, tipo) {
    const dataFormatada = dados.data || 'Data n/a';
    const horario = Array.isArray(dados.horario) ? dados.horario.join(', ') : (dados.horario || 'Horário n/a');
    const laboratorio = dados.laboratorio || 'Lab n/a';
    const assunto = dados.assunto || 'Sem assunto';
    const cursos = Array.isArray(dados.cursos) ? dados.cursos.join(', ') : (dados.cursos || 'Cursos n/a');

    let textoLink = '';
    if (tipo !== 'excluir') {
        const baseUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
        const complemento = dados.dataISO ? `?date=${dados.dataISO}` : '';
        const linkFinal = `${baseUrl}/calendario${complemento}`;
        textoLink = `\n🔗 Ver no Cronograma:\n${linkFinal}`;
    }

    let titulo = '';
    let emoji = '';

    switch (tipo) {
      case 'adicionar': titulo = 'NOVA AULA ADICIONADA'; emoji = '✅'; break;
      case 'editar': titulo = 'AULA EDITADA'; emoji = '✏️'; break;
      case 'excluir': titulo = 'AULA EXCLUÍDA'; emoji = '🗑️'; break;
      default: titulo = 'NOTIFICAÇÃO'; emoji = '📢';
    }

    return `
${emoji} ${titulo}

📖 Assunto: ${assunto}
📅 Data: ${dataFormatada}
🕐 Horário: ${horario}
🏢 Laboratório: ${laboratorio}
👥 Cursos: ${cursos}

${dados.observacoes ? `📝 Obs: ${dados.observacoes}\n` : ''}
${textoLink}
    `.trim();
  }

  async enviarParaMultiplos(chatIds, dados, tipo) {
    if (!Array.isArray(chatIds) || chatIds.length === 0) return { sucesso: 0, falha: 0 };
    const resultados = await Promise.all(chatIds.map(id => this.enviarNotificacao(id, dados, tipo)));
    return { sucesso: resultados.filter(r => r).length, falha: resultados.filter(r => !r).length };
  }
}

export const notificadorTelegram = new NotificadorTelegram();
export default NotificadorTelegram;